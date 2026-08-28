const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  probeWindowsCodeCmd,
  resolveWindowsCodeLauncher,
  windowsCodeCmdCandidates
} = require('../lib/vscode-cli');

function fakeFs(existing) {
  const set = new Set(existing.map(item => path.normalize(item)));
  return {
    existsSync(file) {
      return set.has(path.normalize(file));
    }
  };
}

const windowsTest = process.platform === 'win32' ? test : test.skip;

windowsTest('resolves a standard VS Code code.cmd by probing --version', () => {
  const root = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code';
  const cmd = path.join(root, 'bin', 'code.cmd');
  const fsApi = fakeFs([cmd]);
  const env = {
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    Path: 'D:\\project\\node_modules\\.bin;C:\\tools'
  };
  const execFile = (_exe, args) => {
    const command = args[args.length - 1];
    assert.match(command, /code\.cmd/i);
    assert.match(command, /--version/);
    return '1.133.0\r\nabcdef\r\nx64\r\n';
  };

  const launcher = resolveWindowsCodeLauncher(env, fsApi, execFile);
  assert.equal(path.normalize(launcher.codeCmd), path.normalize(cmd));
  assert.equal(launcher.version, '1.133.0');
});

windowsTest('prefers standard VS Code location over npm PATH shadow', () => {
  const root = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code';
  const cmd = path.join(root, 'bin', 'code.cmd');
  const shadow = 'D:\\project\\node_modules\\.bin\\code.cmd';
  const fsApi = fakeFs([cmd, shadow]);
  const env = {
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    Path: 'D:\\project\\node_modules\\.bin;C:\\tools'
  };
  const execFile = () => '1.133.0\r\nabcdef\r\nx64\r\n';

  const launcher = resolveWindowsCodeLauncher(env, fsApi, execFile);
  assert.equal(path.normalize(launcher.codeCmd), path.normalize(cmd));
});

windowsTest('rejects an existing batch file whose --version output is not VS Code', () => {
  const cmd = 'C:\\tools\\code.cmd';
  const fsApi = fakeFs([cmd]);
  const execFile = () => 'not vscode\r\n';
  assert.equal(probeWindowsCodeCmd(cmd, { fsApi, execFile, env: { ComSpec: 'cmd.exe' } }), null);
});

windowsTest('explicit GHOST_TYPING_CODE_CMD is checked first', () => {
  const env = {
    GHOST_TYPING_CODE_CMD: '"C:\\VS Code\\bin\\code.cmd"',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    Path: 'C:\\other'
  };
  const candidates = windowsCodeCmdCandidates(env);
  assert.equal(path.normalize(candidates[0]), path.normalize('C:\\VS Code\\bin\\code.cmd'));
});
