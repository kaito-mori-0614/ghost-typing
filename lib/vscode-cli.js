const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function stripOuterQuotes(value) {
  const text = String(value || '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = process.platform === 'win32' ? value.toLowerCase() : value;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function windowsCodeCmdCandidates(env = process.env) {
  const candidates = [];
  if (env.GHOST_TYPING_CODE_CMD) {
    candidates.push(path.resolve(stripOuterQuotes(env.GHOST_TYPING_CODE_CMD)));
  }

  const pathValue = env.Path || env.PATH || '';
  for (const rawDir of pathValue.split(path.delimiter)) {
    const dir = stripOuterQuotes(rawDir);
    if (!dir) continue;
    candidates.push(path.join(dir, 'code.cmd'));
  }

  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'));
  }
  if (env.ProgramFiles) {
    candidates.push(path.join(env.ProgramFiles, 'Microsoft VS Code', 'bin', 'code.cmd'));
  }
  if (env['ProgramFiles(x86)']) {
    candidates.push(path.join(env['ProgramFiles(x86)'], 'Microsoft VS Code', 'bin', 'code.cmd'));
  }

  return unique(candidates.map(candidate => path.normalize(candidate)));
}

function inspectWindowsCodeCmd(codeCmd, fsApi = fs) {
  try {
    if (!fsApi.existsSync(codeCmd)) return null;
    const script = fsApi.readFileSync(codeCmd, 'utf8');
    if (!/resources\\app\\out\\cli\.js/i.test(script)) return null;

    const executableMatch = script.match(/%~dp0\.\.\\([^"\r\n]+\.exe)/i);
    if (!executableMatch) return null;

    const installRoot = path.resolve(path.dirname(codeCmd), '..');
    const executable = path.join(installRoot, executableMatch[1]);
    const cli = path.join(installRoot, 'resources', 'app', 'out', 'cli.js');
    if (!fsApi.existsSync(executable) || !fsApi.existsSync(cli)) return null;

    return { codeCmd, installRoot, executable, cli };
  } catch {
    return null;
  }
}

function resolveWindowsCodeLauncher(env = process.env, fsApi = fs) {
  const candidates = windowsCodeCmdCandidates(env);
  for (const candidate of candidates) {
    const launcher = inspectWindowsCodeCmd(candidate, fsApi);
    if (launcher) return launcher;
  }

  const shown = candidates.length ? `\nChecked:\n${candidates.map(item => `  ${item}`).join('\n')}` : '';
  throw new Error(`VS Code code.cmd was not found or was not a valid VS Code CLI.${shown}`);
}

function runCode(args, options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const fsApi = options.fsApi || fs;
  const execFile = options.execFile || execFileSync;

  if (platform !== 'win32') {
    return execFile('code', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  const launcher = resolveWindowsCodeLauncher(env, fsApi);
  const childEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' };
  delete childEnv.VSCODE_DEV;

  return execFile(launcher.executable, [launcher.cli, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
    windowsHide: true
  });
}

module.exports = {
  inspectWindowsCodeCmd,
  resolveWindowsCodeLauncher,
  runCode,
  windowsCodeCmdCandidates
};
