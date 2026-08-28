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

  // npm run prepends node_modules/.bin to PATH. Prefer known VS Code
  // installation locations so an unrelated package named `code` cannot shadow it.
  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'));
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'));
  }
  if (env.ProgramFiles) {
    candidates.push(path.join(env.ProgramFiles, 'Microsoft VS Code', 'bin', 'code.cmd'));
    candidates.push(path.join(env.ProgramFiles, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'));
  }
  if (env['ProgramFiles(x86)']) {
    candidates.push(path.join(env['ProgramFiles(x86)'], 'Microsoft VS Code', 'bin', 'code.cmd'));
  }

  const pathValue = env.Path || env.PATH || '';
  for (const rawDir of pathValue.split(path.delimiter)) {
    const dir = stripOuterQuotes(rawDir);
    if (!dir) continue;
    candidates.push(path.join(dir, 'code.cmd'));
    candidates.push(path.join(dir, 'code-insiders.cmd'));
  }

  return unique(candidates.map(candidate => path.normalize(candidate)));
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function runWindowsBatch(batchFile, args, options = {}) {
  const env = options.env || process.env;
  const execFile = options.execFile || execFileSync;
  const comspec = env.ComSpec || env.COMSPEC || 'cmd.exe';
  // `call` is deliberate: the target is a .cmd file. We invoke its absolute path
  // through cmd.exe instead of asking Node or npm-modified PATH to resolve `code`.
  const command = ['call', quoteCmdArg(batchFile), ...args.map(quoteCmdArg)].join(' ');
  return execFile(comspec, ['/d', '/s', '/c', command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    windowsHide: true
  });
}

function probeWindowsCodeCmd(codeCmd, options = {}) {
  const fsApi = options.fsApi || fs;
  if (!fsApi.existsSync(codeCmd)) return null;
  try {
    const output = runWindowsBatch(codeCmd, ['--version'], options);
    const firstLine = String(output || '').split(/\r?\n/)[0].trim();
    if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(firstLine)) return null;
    return { codeCmd, version: firstLine };
  } catch {
    return null;
  }
}

function resolveWindowsCodeLauncher(env = process.env, fsApi = fs, execFile = execFileSync) {
  const candidates = windowsCodeCmdCandidates(env);
  for (const candidate of candidates) {
    const launcher = probeWindowsCodeCmd(candidate, { env, fsApi, execFile });
    if (launcher) return launcher;
  }

  const shown = candidates.length ? `\nChecked:\n${candidates.map(item => `  ${item}`).join('\n')}` : '';
  throw new Error(
    'VS Code CLI could not be resolved. Existing code.cmd candidates were probed with --version, but none returned a valid VS Code version.'
    + shown
  );
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

  const launcher = options.launcher || resolveWindowsCodeLauncher(env, fsApi, execFile);
  return runWindowsBatch(launcher.codeCmd, args, { env, execFile });
}

module.exports = {
  probeWindowsCodeCmd,
  quoteCmdArg,
  resolveWindowsCodeLauncher,
  runCode,
  runWindowsBatch,
  windowsCodeCmdCandidates
};
