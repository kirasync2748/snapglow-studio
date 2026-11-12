import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await Promise.all([
  build({
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['vscode'],
    minify: true,
    legalComments: 'eof',
  }),
  build({
    entryPoints: ['src/webview/studio.ts'],
    outfile: 'dist/studio.js',
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
    minify: true,
    legalComments: 'eof',
  }),
  copyFile('src/webview/studio.css', 'dist/studio.css'),
  copyFile('assets/icon.png', 'dist/icon.png'),
  copyFile(
    'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
    'dist/mono.woff2',
  ),
  copyFile(
    'node_modules/@fontsource/jetbrains-mono/LICENSE',
    'dist/FONT-LICENSE.txt',
  ),
]);
console.log('Built extension and offline studio.');
