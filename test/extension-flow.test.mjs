import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
test('opening an existing studio preserves its source; captures number the actual selected range', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'snapglow-flow-'));
  const posted = [],
    commands = new Map();
  let receive;
  let reveals = 0;
  const editor = {
    selection: { isEmpty: true, start: { line: 42 } },
    document: {
      getText: () => 'whole document',
      languageId: 'typescript',
      uri: { path: '/file.ts' },
    },
  };
  const panel = {
    reveal: () => {
      reveals++;
    },
    onDidDispose: () => {},
    dispose: () => {},
    webview: {
      postMessage: async (m) => {
        posted.push(m);
      },
      onDidReceiveMessage: (cb) => {
        receive = cb;
        return { dispose() {} };
      },
      asWebviewUri: (uri) => uri,
      cspSource: 'local',
    },
  };
  globalThis.__snapglowFlow = {
    window: { activeTextEditor: editor, createWebviewPanel: () => panel },
    workspace: { getConfiguration: () => ({ get: () => true }) },
    commands: {
      registerCommand: (name, fn) => {
        commands.set(name, fn);
        return { dispose() {} };
      },
    },
    Uri: { joinPath: (...parts) => parts.join('/') },
    ViewColumn: { Beside: 2 },
  };
  try {
    const file = join(dir, 'extension.cjs');
    await build({
      entryPoints: ['src/extension.ts'],
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      plugins: [
        {
          name: 'mock-vscode',
          setup(b) {
            b.onResolve({ filter: /^vscode$/ }, () => ({
              path: 'vscode',
              namespace: 'mock',
            }));
            b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
              contents:
                'const api=globalThis.__snapglowFlow; export const window=api.window, workspace=api.workspace, commands=api.commands, Uri=api.Uri, ViewColumn=api.ViewColumn;',
            }));
          },
        },
      ],
    });
    const extension = createRequire(import.meta.url)(file);
    extension.activate({
      extensionUri: '/extension',
      subscriptions: [],
      globalState: { get: () => undefined },
    });
    commands.get('snapglow.capture')();
    await receive({ type: 'ready' });
    assert.equal(posted.at(-1).snippet.startLine, 1);
    assert.equal(posted.at(-1).snippet.code, 'whole document');
    const count = posted.length;
    commands.get('snapglow.open')();
    assert.equal(posted.length, count);
    assert.equal(reveals, 1);
    editor.selection.isEmpty = false;
    editor.document.getText = () => 'selected source';
    commands.get('snapglow.open')();
    assert.equal(posted.at(-1).snippet.code, 'selected source');
    assert.equal(posted.at(-1).snippet.startLine, 43);
    editor.selection.isEmpty = true;
    commands.get('snapglow.capture')();
    assert.equal(posted.at(-1).snippet.startLine, 1);
    delete globalThis.__snapglowFlow.window.activeTextEditor;
    const noEditorCount = posted.length;
    commands.get('snapglow.open')();
    assert.equal(posted.length, noEditorCount);
    extension.deactivate();
  } finally {
    delete globalThis.__snapglowFlow;
    await rm(dir, { recursive: true, force: true });
  }
});
