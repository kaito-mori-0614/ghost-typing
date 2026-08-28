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

  // Match Node.js' own Windows shell execution semantics: cmd.exe receives one
  // fully quoted command after /d /s /c and windowsVerbatimArguments prevents
  // Node from re-escaping the command line for the C runtime. A .cmd file does
  // not need `call` here because it is the top-level /c command.
  const command = [quoteCmdArg(batchFile), ...args.map(quoteCmdArg)].join(' ');
  return execFile(comspec, ['/d', '/s', '/c', `"${command}"`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    windowsHide: true,
    windowsVerbatimArguments: true
  });
}

function firstVersionLine(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(line)) || null;
}

function probeWindowsCodeCmd(codeCmd, options = {}) {
  const fsApi = options.fsApi || fs;
  if (!fsApi.existsSync(codeCmd)) return { ok: false, reason: 'not found' };

  try {
    const output = runWindowsBatch(codeCmd, ['--version'], options);
    const version = firstVersionLine(output);
    if (!version) {
      return {
        ok: false,
        reason: `--version succeeded but no VS Code version line was found; stdout=${JSON.stringify(String(output || ''))}`
      };
    }
    return { ok: true, codeCmd, version };
  } catch (error) {
    return {
      ok: false,
      reason: `exit=${error?.status ?? 'unknown'} stdout=${JSON.stringify(String(error?.stdout || ''))} stderr=${JSON.stringify(String(error?.stderr || ''))}`
    };
  }
}

function resolveWindowsCodeLauncher(env = process.env, fsApi = fs, execFile = execFileSync) {
  const candidates = windowsCodeCmdCandidates(env);
  const diagnostics = [];

  for (const candidate of candidates) {
    if (!fsApi.existsSync(candidate)) continue;
    const probe = probeWindowsCodeCmd(candidate, { env, fsApi, execFile });
    if (probe.ok) return { codeCmd: probe.codeCmd, version: probe.version };
    diagnostics.push(`${candidate}\n    ${probe.reason}`);
  }

  const shown = diagnostics.length
    ? `\nExisting candidates and probe results:\n  ${diagnostics.join('\n  ')}`
    : `\nNo candidate files existed. Checked:\n  ${candidates.join('\n  ')}`;
  throw new Error(
    'VS Code CLI could not be resolved. Ghost Typing probes the absolute code.cmd path with --version and only accepts a working VS Code CLI.'
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
  firstVersionLine,
  probeWindowsCodeCmd,
  quoteCmdArg,
  resolveWindowsCodeLauncher,
  runCode,
  runWindowsBatch,
  windowsCodeCmdCandidates
};
