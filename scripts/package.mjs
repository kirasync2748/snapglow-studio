import { packageReadme } from './package-readme.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/package-readme.md',
  await packageReadme(await readFile('README.md', 'utf8')),
);
const result = spawnSync(
  process.execPath,
  [
    'node_modules/@vscode/vsce/vsce',
    'package',
    '--no-dependencies',
    '--readme-path',
    'artifacts/package-readme.md',
    '--no-rewrite-relative-links',
    '--out',
    `artifacts/snapglow-studio-${version}.vsix`,
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
