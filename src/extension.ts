import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { saveExport } from './shared/export';
import {
  DEFAULT_SETTINGS,
  MAX_CODE_LENGTH,
  SAMPLE,
  isExportMessage,
  parseSettings,
  parsePresets,
  type Snippet,
} from './shared/model';
let panel: vscode.WebviewPanel | undefined;
let latestSnippet: Snippet = SAMPLE;
export function activate(context: vscode.ExtensionContext): void {
  function open(capture: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (panel && !capture && (!editor || editor.selection.isEmpty)) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    let snippet: Snippet = SAMPLE;
    if (editor && (capture || !editor.selection.isEmpty)) {
      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);
      if (code.length > MAX_CODE_LENGTH) {
        void vscode.window.showWarningMessage(
          'Snapglow supports snippets up to 30,000 characters. Select a smaller section.',
        );
        return;
      }
      snippet = {
        code,
        language: editor.document.languageId,
        title: editor.document.uri.path.split('/').pop() || 'snippet',
        startLine:
          !selection.isEmpty &&
          vscode.workspace
            .getConfiguration('snapglow')
            .get('keepOriginalLineNumbers', false)
            ? selection.start.line + 1
            : 1,
      };
    }
    latestSnippet = snippet;
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      void panel.webview.postMessage({ type: 'snippet', snippet });
      return;
    }
    const current = vscode.window.createWebviewPanel(
      'snapglow.studio',
      'Snapglow Studio',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      },
    );
    panel = current;
    current.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'assets',
      'icon.png',
    );
    let lastDirectory: vscode.Uri | undefined;
    let exporting = false;
    const listener = current.webview.onDidReceiveMessage(
      async (message: unknown) => {
        if (!message || typeof message !== 'object' || !('type' in message))
          return;
        if (message.type === 'ready') {
          await current.webview.postMessage({
            type: 'init',
            snippet: latestSnippet,
            settings:
              parseSettings(context.globalState.get('settings')) ??
              DEFAULT_SETTINGS,
            presets: parsePresets(context.globalState.get('presets')) ?? [],
          });
        } else if (
          message.type === 'persist' &&
          'settings' in message &&
          'presets' in message
        ) {
          const settings = parseSettings(message.settings),
            presets = parsePresets(message.presets);
          if (settings && presets)
            await Promise.all([
              context.globalState.update('settings', settings),
              context.globalState.update('presets', presets),
            ]).catch(() => {
              void vscode.window.showWarningMessage(
                'Snapglow could not save appearance settings. Check available disk space.',
              );
            });
        } else if (isExportMessage(message) && !exporting) {
          exporting = true;
          try {
            const result = await saveExport(
              message,
              async () => {
                const uri = await vscode.window.showSaveDialog({
                  defaultUri: lastDirectory
                    ? vscode.Uri.joinPath(lastDirectory, message.filename)
                    : vscode.Uri.file(join(homedir(), message.filename)),
                  filters: { [message.format.toUpperCase()]: [message.format] },
                  saveLabel: 'Save image',
                  title: 'Save Snapglow image',
                });
                if (uri) lastDirectory = vscode.Uri.joinPath(uri, '..');
                return uri;
              },
              async (uri, bytes) => {
                await vscode.workspace.fs.writeFile(uri, bytes);
              },
            );
            if (result === 'cancelled') {
              await current.webview.postMessage({
                type: 'exportResult',
                status: 'cancelled',
              });
              return;
            }
            await current.webview.postMessage({
              type: 'exportResult',
              status: 'saved',
            });
            void vscode.window.showInformationMessage(
              `Saved ${message.filename}`,
            );
          } catch (error) {
            const text =
              error instanceof Error ? error.message : 'Unable to save image.';
            await current.webview.postMessage({
              type: 'exportResult',
              status: 'error',
              message: text,
            });
            void vscode.window.showErrorMessage(`Snapglow: ${text}`);
          } finally {
            exporting = false;
          }
        }
      },
    );
    current.onDidDispose(() => {
      if (panel === current) panel = undefined;
      listener.dispose();
    });
    const nonce = randomBytes(24).toString('base64');
    const script = current.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'studio.js'),
    );
    const style = current.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'studio.css'),
    );
    current.webview.html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${current.webview.cspSource} data: blob:; font-src ${current.webview.cspSource} data:; style-src ${current.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; connect-src ${current.webview.cspSource};"><link rel="stylesheet" href="${style}"><title>Snapglow Studio</title></head><body><div id="app"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('snapglow.capture', () => open(true)),
    vscode.commands.registerCommand('snapglow.open', () => open(false)),
    { dispose: () => panel?.dispose() },
  );
}
export function deactivate(): void {
  panel?.dispose();
  panel = undefined;
}
