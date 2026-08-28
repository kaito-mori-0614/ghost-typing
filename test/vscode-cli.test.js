const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  inspectWindowsCodeCmd,
  resolveWindowsCodeLauncher,
  windowsCodeCmdCandidates
} = require('../lib/vscode-cli');

function fakeFs(files) {
  const map = new Map(Object.entries(files).map(([key, value]) => [path.normalize(key), value]));
  return {
    existsSync(file) {
      return map.has(path.normalize(file));
    }
  };
}

const windowsTest = process.platform === 'win32' ? test : test.skip;

windowsTest('resolves a standard VS Code install without parsing code.cmd contents', () => {
  const root = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code';
  const cmd = path.join(root, 'bin', 'code.cmd');
  const exe = path.join(root, 'Code.exe');
  const cli = path.join(root, 'resources', 'app', 'out', 'cli.js');
  const fsApi = fakeFs({
    [cmd]: 'opaque launcher text that may change between VS Code versions',
    [exe]: '',
    [cli]: ''
  });
  const env = {
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    Path: 'D:\\project\\node_modules\\.bin;C:\\tools'
  };

  const launcher = resolveWindowsCodeLauncher(env, fsApi);
  assert.equal(path.normalize(launcher.codeCmd), path.normalize(cmd));
  assert.equal(path.normalize(launcher.executable), path.normalize(exe));
  assert.equal(path.normalize(launcher.cli), path.normalize(cli));
});

windowsTest('prefers standard VS Code location over npm PATH shadow', () => {
  const root = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code';
  const cmd = path.join(root, 'bin', 'code.cmd');
  const exe = path.join(root, 'Code.exe');
  const cli = path.join(root, 'resources', 'app', 'out', 'cli.js');
  const shadow = 'D:\\project\\node_modules\\.bin\\code.cmd';
  const fsApi = fakeFs({
    [shadow]: '',
    [cmd]: '',
    [exe]: '',
    [cli]: ''
  });
  const env = {
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    Path: 'D:\\project\\node_modules\\.bin;C:\\tools'
  };

  const launcher = resolveWindowsCodeLauncher(env, fsApi);
  assert.equal(path.normalize(launcher.codeCmd), path.normalize(cmd));
});

windowsTest('rejects a stray code.cmd without a VS Code installation layout', () => {
  const cmd = 'C:\\tools\\code.cmd';
  const fsApi = fakeFs({ [cmd]: '' });
  assert.equal(inspectWindowsCodeCmd(cmd, fsApi), null);
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
