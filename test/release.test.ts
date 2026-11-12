import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
test('release guard rejects wrong repository, mismatched tags and missing artwork', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'snapglow-release-'));
  try {
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'snapglow-studio',
        publisher: 'kirasync2748',
        version: '0.1.0',
      }),
    );
    const script = resolve('scripts/verify-release.mjs');
    for (const [repo, tag, error] of [
      ['someone/else', 'v0.1.0', 'only enabled from'],
      ['kirasync2748/snapglow-studio', 'v0.2.0', 'Release tag must'],
      ['kirasync2748/snapglow-studio', 'v0.1.0', 'final anime artwork'],
    ] as const) {
      const result = spawnSync(process.execPath, [script], {
        cwd,
        env: { ...process.env, GITHUB_REPOSITORY: repo, RELEASE_TAG: tag },
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(error));
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
