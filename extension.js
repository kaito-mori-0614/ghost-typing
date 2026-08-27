const vscode = require('vscode');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { firstChange, remainingInsertedTextAtCursor } = require('./lib/ghost-diff');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\r\n/g, '\n');
}

function repoRootForDocument(document) {
  const folders = vscode.workspace.workspaceFolders || [];
  const match = folders
    .filter(folder => document.uri.fsPath.startsWith(folder.uri.fsPath))
    .sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length)[0];
  if (!match) return null;
  try {
    return git(match.uri.fsPath, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }
}

function targetFromBranch(root) {
  const branch = git(root, ['branch', '--show-current']).trim();
  const prefix = 'ghost-typing/';
  if (!branch.startsWith(prefix)) return null;
  const target = branch.slice(prefix.length);
  const candidates = [target, `origin/${target}`];
  for (const candidate of candidates) {
    try {
      git(root, ['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {}
  }
  return null;
}

function relativeGitPath(root, document) {
  return path.relative(root, document.uri.fsPath).split(path.sep).join('/');
}

function targetText(root, targetRef, relPath) {
  try {
    return git(root, ['show', `${targetRef}:${relPath}`]);
  } catch {
    return null;
  }
}

function offsetToPosition(document, offset) {
  return document.positionAt(Math.max(0, Math.min(offset, document.getText().length)));
}

async function ensureTargetFiles(root, targetRef) {
  let names = '';
  try {
    names = git(root, ['diff', '--name-status', 'HEAD', targetRef]);
  } catch {
    return;
  }

  for (const line of names.split('\n')) {
    if (!line) continue;
    const [status, ...rest] = line.split('\t');
    const relPath = rest[rest.length - 1];
    if (!relPath || status.startsWith('D')) continue;
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, '', 'utf8');
    }
  }
}

function activate(context) {
  const deletionDecoration = vscode.window.createTextEditorDecorationType({
    opacity: '0.45',
    textDecoration: 'line-through'
  });
  context.subscriptions.push(deletionDecoration);

  async function refreshDeletion(editor) {
    if (!editor) return;
    const document = editor.document;
    const root = repoRootForDocument(document);
    if (!root) return editor.setDecorations(deletionDecoration, []);
    const targetRef = targetFromBranch(root);
    if (!targetRef) return editor.setDecorations(deletionDecoration, []);
    const relPath = relativeGitPath(root, document);
    const target = targetText(root, targetRef, relPath);
    if (target == null) return editor.setDecorations(deletionDecoration, []);

    const change = firstChange(document.getText().replace(/\r\n/g, '\n'), target.replace(/\r\n/g, '\n'));
    if (!change || !change.removedText) return editor.setDecorations(deletionDecoration, []);

    const start = offsetToPosition(document, change.currentOffset);
    const end = offsetToPosition(document, change.currentOffset + change.removedText.length);
    editor.setDecorations(deletionDecoration, [new vscode.Range(start, end)]);
  }

  const provider = vscode.languages.registerInlineCompletionItemProvider(
    [{ scheme: 'file' }],
    {
      provideInlineCompletionItems(document, position) {
        const root = repoRootForDocument(document);
        if (!root) return [];
        const targetRef = targetFromBranch(root);
        if (!targetRef) return [];
        const relPath = relativeGitPath(root, document);
        const target = targetText(root, targetRef, relPath);
        if (target == null) return [];

        const current = document.getText().replace(/\r\n/g, '\n');
        const normalizedTarget = target.replace(/\r\n/g, '\n');
        const cursorOffset = document.offsetAt(position);
        const insertText = remainingInsertedTextAtCursor(current, normalizedTarget, cursorOffset);
        if (!insertText) return [];

        return [new vscode.InlineCompletionItem(insertText, new vscode.Range(position, position))];
      }
    }
  );
  context.subscriptions.push(provider);

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.nextChange', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const document = editor.document;
    const root = repoRootForDocument(document);
    if (!root) return;
    const targetRef = targetFromBranch(root);
    if (!targetRef) {
      vscode.window.showInformationMessage('ghost-typing: current branch is not a ghost-typing branch.');
      return;
    }

    const relPath = relativeGitPath(root, document);
    const target = targetText(root, targetRef, relPath);
    if (target == null) return;
    const change = firstChange(document.getText().replace(/\r\n/g, '\n'), target.replace(/\r\n/g, '\n'));
    if (!change) {
      vscode.window.showInformationMessage(`ghost-typing: ${relPath} matches ${targetRef}`);
      return;
    }

    const pos = offsetToPosition(document, change.currentOffset);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    await refreshDeletion(editor);
    await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
  }));

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(refreshDeletion));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    if (vscode.window.activeTextEditor?.document === event.document) {
      refreshDeletion(vscode.window.activeTextEditor);
      vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
    }
  }));

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (root) {
    try {
      const actualRoot = git(root, ['rev-parse', '--show-toplevel']).trim();
      const targetRef = targetFromBranch(actualRoot);
      if (targetRef) ensureTargetFiles(actualRoot, targetRef);
    } catch {}
  }

  refreshDeletion(vscode.window.activeTextEditor);
}

function deactivate() {}

module.exports = { activate, deactivate };
