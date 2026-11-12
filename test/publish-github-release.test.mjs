import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  chmod,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/publish-github-release.sh');
const mockGh = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const config = JSON.parse(process.env.MOCK_CONFIG);
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(args) + '\\n');
if (args[1] === 'view') {
  if (config.missing && !fs.existsSync(process.env.MOCK_CREATED)) process.exit(1);
  console.log(JSON.stringify({isDraft: !!config.draft, isPrerelease: !!config.prerelease, assets: Object.keys(config.assets).map(name => ({name}))}));
} else if (args[1] === 'create') {
  if (config.createFails) process.exit(1);
  fs.writeFileSync(process.env.MOCK_CREATED, 'created');
} else if (args[1] === 'download') {
  const name = args[args.indexOf('--pattern') + 1];
  const dir = args[args.indexOf('--dir') + 1];
  fs.writeFileSync(path.join(dir, name), config.assets[name]);
} else if (args[1] === 'upload') {
  if (config.uploadFails) process.exit(1);
} else {
  process.exit(2);
}
`;

async function runRelease(config) {
  const cwd = await mkdtemp(join(tmpdir(), 'snapglow-publish-'));
  try {
    await mkdir(join(cwd, 'artifacts'));
    await mkdir(join(cwd, 'bin'));
    await writeFile(join(cwd, 'artifacts', 'snapglow.vsix'), 'package');
    await writeFile(join(cwd, 'artifacts', 'SHA256SUMS'), 'checksum');
    await writeFile(join(cwd, 'bin', 'gh'), mockGh);
    await chmod(join(cwd, 'bin', 'gh'), 0o755);
    const log = join(cwd, 'commands');
    const result = spawnSync('bash', [script], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        // Keep shell startup configuration from changing the mocked command path.
        BASH_ENV: '',
        PATH: `${join(cwd, 'bin')}:${process.env.PATH}`,
        GITHUB_REPOSITORY: 'kirasync2748/snapglow-studio',
        RELEASE_TAG: 'v0.1.0',
        MOCK_CONFIG: JSON.stringify({ assets: {}, ...config }),
        MOCK_LOG: log,
        MOCK_CREATED: join(cwd, 'created'),
      },
    });
    const calls = (await readFile(log, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    return { result, calls };
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('creates a new release and uploads the verified assets', async () => {
  const { result, calls } = await runRelease({ missing: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.map((call) => call[1]),
    ['view', 'create', 'view', 'upload'],
  );
  assert.ok(calls[1].includes('--verify-tag'));
  assert.deepEqual(calls[3].slice(-2), [
    'artifacts/snapglow.vsix',
    'artifacts/SHA256SUMS',
  ]);
});

test('completes an existing release without replacing its assets', async () => {
  const { result, calls } = await runRelease({
    assets: { 'snapglow.vsix': 'package' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.map((call) => call[1]),
    ['view', 'download', 'upload'],
  );
  assert.equal(calls[2].at(-1), 'artifacts/SHA256SUMS');
  assert.ok(!calls[2].includes('--clobber'));
});

test('accepts identical existing assets on a rerun', async () => {
  const { result, calls } = await runRelease({
    assets: { 'snapglow.vsix': 'package', SHA256SUMS: 'checksum' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.map((call) => call[1]),
    ['view', 'download', 'download'],
  );
});

test('fails before uploading if an existing asset differs', async () => {
  const { result, calls } = await runRelease({
    assets: { SHA256SUMS: 'different' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /differs from the verified build/);
  assert.ok(!calls.some((call) => call[1] === 'upload'));
});

test('does not publish through a draft or prerelease', async () => {
  for (const config of [{ draft: true }, { prerelease: true }]) {
    const { result, calls } = await runRelease(config);
    assert.notEqual(result.status, 0);
    assert.ok(!calls.some((call) => call[1] === 'upload'));
  }
});

test('propagates creation and upload failures', async () => {
  for (const config of [
    { missing: true, createFails: true },
    { uploadFails: true },
  ]) {
    const { result } = await runRelease(config);
    assert.notEqual(result.status, 0);
  }
});
