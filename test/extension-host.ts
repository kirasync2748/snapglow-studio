import * as vscode from 'vscode';
import assert from 'node:assert/strict';
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    'kirasync2748.snapglow-studio',
  );
  assert.ok(extension, 'Extension installed in test host');
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('snapglow.capture'));
  assert.ok(commands.includes('snapglow.open'));
  const doc = await vscode.workspace.openTextDocument({
    content: 'const greeting = "hello";\nconsole.log(greeting);',
    language: 'javascript',
  });
  const editor = await vscode.window.showTextDocument(doc);
  editor.selection = new vscode.Selection(0, 0, 1, 22);
  await vscode.commands.executeCommand('snapglow.capture');
  await vscode.commands.executeCommand('snapglow.open');
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  console.log('Extension activation and capture commands passed.');
}
