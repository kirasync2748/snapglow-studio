import { runTests } from '@vscode/test-electron';
import { build } from 'esbuild';
await build({
  entryPoints: ['test/extension-host.ts'],
  outfile: 'dist/test/extension-host.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  target: 'node22',
});
await runTests({
  extensionDevelopmentPath: process.cwd(),
  extensionTestsPath: `${process.cwd()}/dist/test/extension-host.cjs`,
  launchArgs: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    '--skip-welcome',
    '--skip-release-notes',
  ],
  version: 'stable',
});
