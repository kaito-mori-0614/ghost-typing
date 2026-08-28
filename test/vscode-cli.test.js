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
    },
    readFileSync(file) {
      const value = map.get(path.normalize(file));
      if (value == null) throw new Error('ENOENT');
      return value;
    }
  };
}

const windowsTest = process.platform === 'win32' ? test : test.skip;

windowsTest('finds VS Code code.cmd from PATH without shell resolution', () => {
  const root = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code';
  const cmd = path.join(root, 'bin', 'code.cmd');
  const exe = path.join(root, 'Code.exe');
  const cli = path.join(root, 'resources', 'app', 'out', 'cli.js');
  const fsApi = fakeFs({
    [cmd]: '@echo off\r\n"%~dp0..\\Code.exe" "%~dp0..\\resources\\app\\out\\cli.js" %*\r\n',
    [exe]: '',
    [cli]: ''
  });
  const env = { Path: `C:\\tools;${path.join(root, 'bin')}` };

  const launcher = resolveWindowsCodeLauncher(env, fsApi);
  assert.equal(path.normalize(launcher.codeCmd), path.normalize(cmd));
  assert.equal(path.normalize(launcher.executable), path.normalize(exe));
  assert.equal(path.normalize(launcher.cli), path.normalize(cli));
});

windowsTest('rejects a code.cmd that is not the VS Code CLI', () => {
  const cmd = 'C:\\tools\\code.cmd';
  const fsApi = fakeFs({ [cmd]: '@echo off\r\necho not vscode\r\n' });
  assert.equal(inspectWindowsCodeCmd(cmd, fsApi), null);
});

windowsTest('explicit GHOST_TYPING_CODE_CMD is checked first', () => {
  const env = {
    GHOST_TYPING_CODE_CMD: '"C:\\VS Code\\bin\\code.cmd"',
    Path: 'C:\\other'
  };
  const candidates = windowsCodeCmdCandidates(env);
  assert.equal(path.normalize(candidates[0]), path.normalize('C:\\VS Code\\bin\\code.cmd'));
});
