const vscode = require('vscode');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const {
  normalizeText,
  inputLinesFromUnifiedDiff,
  scaffoldForTarget,
  mismatchRanges,
  firstMismatchIndex
} = require('./lib/ghost-diff');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).replace(/\r\n/g, '\n');
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
  for (const candidate of [target, `origin/${target}`]) {
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

function textAtRef(root, ref, relPath) {
  try {
    return normalizeText(git(root, ['show', `${ref}:${relPath}`]));
  } catch {
    return null;
  }
}

function diffFromHead(root, targetRef, relPath) {
  return git(root, ['diff', '--unified=0', '--no-color', 'HEAD', targetRef, '--', relPath]);
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

async function replaceDocumentText(editor, text) {
  const document = editor.document;
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  const ok = await editor.edit(editBuilder => editBuilder.replace(fullRange, text), {
    undoStopBefore: true,
    undoStopAfter: true
  });
  if (!ok) return false;
  await document.save();
  return true;
}

function documentLines(document) {
  const lines = [];
  for (let i = 0; i < document.lineCount; i += 1) lines.push(document.lineAt(i).text);
  return lines;
}

function structurallyCompatible(lines, targetLines, inputLines) {
  if (lines.length !== targetLines.length) return false;
  for (let i = 0; i < targetLines.length; i += 1) {
    if (inputLines.has(i)) continue;
    if (lines[i] !== targetLines[i]) return false;
  }
  return true;
}

function activate(context) {
  const sessions = new Map();
  const initializing = new Map();
  const invalidWarnings = new Set();

  const ghostDecoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorGhostText.foreground')
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });

  const errorBackgroundDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.10)',
    borderRadius: '2px'
  });

  const diagnostics = vscode.languages.createDiagnosticCollection('ghost-typing');
  context.subscriptions.push(ghostDecoration, errorBackgroundDecoration, diagnostics);

  function hideNativeInlineSuggestion() {
    vscode.commands.executeCommand('editor.action.inlineSuggest.hide').then(undefined, () => {});
  }

  async function buildSession(editor, forceReset = false) {
    if (!editor || editor.document.uri.scheme !== 'file') return null;
    const document = editor.document;
    const root = repoRootForDocument(document);
    if (!root) return null;
    const targetRef = targetFromBranch(root);
    if (!targetRef) return null;
    const relPath = relativeGitPath(root, document);
    const targetText = textAtRef(root, targetRef, relPath);
    if (targetText == null) return null;

    let diffText;
    try {
      diffText = diffFromHead(root, targetRef, relPath);
    } catch {
      return null;
    }

    const inputLines = inputLinesFromUnifiedDiff(diffText);
    const scaffold = scaffoldForTarget(targetText, inputLines);
    const baseText = textAtRef(root, 'HEAD', relPath) ?? '';
    const currentText = normalizeText(document.getText());

    if ((forceReset || currentText === baseText) && currentText !== scaffold.text) {
      const replaced = await replaceDocumentText(editor, scaffold.text);
      if (!replaced) return null;
    }

    const currentLines = documentLines(document);
    const compatible = structurallyCompatible(currentLines, scaffold.targetLines, inputLines);
    const session = {
      root,
      targetRef,
      relPath,
      inputLines,
      targetLines: scaffold.targetLines,
      scaffoldText: scaffold.text,
      invalid: !compatible
    };

    if (!compatible) {
      const key = document.uri.toString();
      if (!invalidWarnings.has(key)) {
        invalidWarnings.add(key);
        vscode.window.showWarningMessage(
          'ghost-typing: このファイルの行構造がtargetとずれています。"ghost-typing: Reset Current File"で入力用表示を作り直せます。'
        );
      }
    }

    return session;
  }

  async function ensureSession(editor, forceReset = false) {
    if (!editor) return null;
    const key = editor.document.uri.toString();
    if (!forceReset && sessions.has(key)) return sessions.get(key);
    if (!forceReset && initializing.has(key)) return initializing.get(key);

    const promise = buildSession(editor, forceReset).then(session => {
      if (session) sessions.set(key, session);
      else sessions.delete(key);
      initializing.delete(key);
      return session;
    }, error => {
      initializing.delete(key);
      throw error;
    });
    initializing.set(key, promise);
    return promise;
  }

  function expectedLine(session, lineNumber) {
    return session.targetLines[lineNumber] ?? '';
  }

  function isInputLine(session, lineNumber) {
    return session.inputLines.has(lineNumber);
  }

  function refreshEditor(editor, session) {
    if (!editor || !session || session.invalid) {
      if (editor) {
        editor.setDecorations(ghostDecoration, []);
        editor.setDecorations(errorBackgroundDecoration, []);
        diagnostics.delete(editor.document.uri);
      }
      return;
    }

    const document = editor.document;
    if (document.lineCount !== session.targetLines.length) {
      session.invalid = true;
      refreshEditor(editor, session);
      return;
    }

    const ghostOptions = [];
    const errorRanges = [];
    const fileDiagnostics = [];

    for (let lineNumber = 0; lineNumber < session.targetLines.length; lineNumber += 1) {
      const actual = document.lineAt(lineNumber).text;
      const expected = expectedLine(session, lineNumber);

      if (isInputLine(session, lineNumber) && actual.length < expected.length) {
        const suffix = expected.slice(actual.length);
        if (suffix) {
          const pos = new vscode.Position(lineNumber, actual.length);
          ghostOptions.push({
            range: new vscode.Range(pos, pos),
            renderOptions: { after: { contentText: suffix } }
          });
        }
      }

      for (const mismatch of mismatchRanges(actual, expected)) {
        const range = new vscode.Range(
          new vscode.Position(lineNumber, mismatch.start),
          new vscode.Position(lineNumber, mismatch.end)
        );
        errorRanges.push(range);

        const expectedPart = expected.slice(mismatch.start, mismatch.end);
        const message = expectedPart
          ? `ghost-typing: expected "${expectedPart}"`
          : 'ghost-typing: expected end of line';
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
        diagnostic.source = 'ghost-typing';
        fileDiagnostics.push(diagnostic);
      }
    }

    editor.setDecorations(ghostDecoration, ghostOptions);
    editor.setDecorations(errorBackgroundDecoration, errorRanges);
    diagnostics.set(document.uri, fileDiagnostics);
    hideNativeInlineSuggestion();
  }

  async function refreshActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const session = await ensureSession(editor);
    refreshEditor(editor, session);
    updateContexts(editor, session);
  }

  function updateContexts(editor, session) {
    const active = Boolean(editor && session && !session.invalid && session.inputLines.size > 0);
    const lineNumber = editor?.selection?.active?.line ?? -1;
    const cursorOnInputLine = active && session.inputLines.has(lineNumber);
    vscode.commands.executeCommand('setContext', 'ghostTyping.active', active);
    vscode.commands.executeCommand('setContext', 'ghostTyping.cursorOnInputLine', cursorOnInputLine);
  }

  function incompleteInputLines(editor, session) {
    return [...session.inputLines.keys()]
      .sort((a, b) => a - b)
      .filter(lineNumber => editor.document.lineAt(lineNumber).text !== expectedLine(session, lineNumber));
  }

  function moveCursorToInputLine(editor, session, lineNumber) {
    const actual = editor.document.lineAt(lineNumber).text;
    const expected = expectedLine(session, lineNumber);
    const mismatch = firstMismatchIndex(actual, expected);
    const character = mismatch < 0 ? actual.length : Math.min(mismatch, actual.length);
    const pos = new vscode.Position(lineNumber, character);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    updateContexts(editor, session);
  }

  function goToNextInput(editor, session, includeCurrent = true) {
    if (!editor || !session || session.invalid) return false;
    const incomplete = incompleteInputLines(editor, session);
    if (!incomplete.length) {
      vscode.window.setStatusBarMessage(`ghost-typing: ${session.relPath} matches ${session.targetRef}`, 2500);
      return false;
    }

    const currentLine = editor.selection.active.line;
    let next = incomplete.find(line => includeCurrent ? line >= currentLine : line > currentLine);
    if (next == null) next = incomplete[0];
    moveCursorToInputLine(editor, session, next);
    return true;
  }

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.nextChange', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const session = await ensureSession(editor);
    if (!session) {
      vscode.window.showInformationMessage('ghost-typing: no target is active for this file.');
      return;
    }
    if (session.invalid) {
      vscode.window.showWarningMessage('ghost-typing: reset this file before continuing.');
      return;
    }
    goToNextInput(editor, session, true);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.enter', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const session = await ensureSession(editor);
    if (!session || session.invalid) return;

    const lineNumber = editor.selection.active.line;
    if (!session.inputLines.has(lineNumber)) {
      await vscode.commands.executeCommand('type', { text: '\n' });
      return;
    }

    const actual = editor.document.lineAt(lineNumber).text;
    const expected = expectedLine(session, lineNumber);
    if (actual !== expected) {
      const mismatch = firstMismatchIndex(actual, expected);
      const character = mismatch < 0 ? actual.length : Math.min(mismatch, actual.length);
      const pos = new vscode.Position(lineNumber, character);
      editor.selection = new vscode.Selection(pos, pos);
      vscode.window.setStatusBarMessage('ghost-typing: この行はまだtargetと一致していません', 1800);
      return;
    }

    goToNextInput(editor, session, false);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.backspace', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (!editor.selection.isEmpty || editor.selection.active.character > 0) {
      await vscode.commands.executeCommand('deleteLeft');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.delete', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const line = editor.document.lineAt(editor.selection.active.line);
    if (!editor.selection.isEmpty || editor.selection.active.character < line.text.length) {
      await vscode.commands.executeCommand('deleteRight');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('ghost-typing.resetFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const choice = await vscode.window.showWarningMessage(
      'ghost-typing: このファイルを入力開始状態へ戻します。ここまで入力した変更は失われます。',
      { modal: true },
      'Reset'
    );
    if (choice !== 'Reset') return;

    const key = editor.document.uri.toString();
    sessions.delete(key);
    invalidWarnings.delete(key);
    const session = await ensureSession(editor, true);
    refreshEditor(editor, session);
    updateContexts(editor, session);
    if (session && !session.invalid) goToNextInput(editor, session, true);
  }));

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async editor => {
    if (!editor) return;
    const session = await ensureSession(editor);
    refreshEditor(editor, session);
    updateContexts(editor, session);
    if (session && !session.invalid) goToNextInput(editor, session, true);
  }));

  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
    const session = sessions.get(event.textEditor.document.uri.toString());
    updateContexts(event.textEditor, session);
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== event.document) return;
    const session = sessions.get(event.document.uri.toString());
    if (!session) return;

    if (event.document.lineCount !== session.targetLines.length) {
      session.invalid = true;
      if (!invalidWarnings.has(event.document.uri.toString())) {
        invalidWarnings.add(event.document.uri.toString());
        vscode.window.showWarningMessage(
          'ghost-typing: 改行数が変わりました。"ghost-typing: Reset Current File"で入力用表示を作り直してください。'
        );
      }
    }

    refreshEditor(editor, session);
    updateContexts(editor, session);
  }));

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    try {
      const root = git(workspaceRoot, ['rev-parse', '--show-toplevel']).trim();
      const targetRef = targetFromBranch(root);
      if (targetRef) ensureTargetFiles(root, targetRef).then(() => refreshActiveEditor());
      else refreshActiveEditor();
    } catch {
      refreshActiveEditor();
    }
  } else {
    refreshActiveEditor();
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
