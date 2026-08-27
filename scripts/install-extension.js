const { spawnSync } = require('node:child_process');
const path = require('node:path');

const pkg = require('../package.json');
const extensionId = `${pkg.publisher}.${pkg.name}`;
const expected = `${extensionId}@${pkg.version}`;
const vsix = path.resolve(__dirname, '..', 'ghost-typing.vsix');

function fail(message) {
  console.error(`ghost-typing: ${message}`);
  process.exit(1);
}

function runCode(args) {
  if (process.platform === 'win32') {
    const where = spawnSync('where.exe', ['code.cmd'], { encoding: 'utf8', shell: false });
    if (where.error || where.status !== 0) fail('code.cmd was not found in PATH.');

    const codeCmd = String(where.stdout || '').split(/\r?\n/).find(Boolean);
    if (!codeCmd) fail('code.cmd was not found in PATH.');

    const comspec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    const quotedArgs = args.map(arg => `"${String(arg).replace(/"/g, '""')}"`).join(' ');
    const commandLine = `call "${codeCmd}" ${quotedArgs}`;

    return {
      command: codeCmd,
      result: spawnSync(comspec, ['/d', '/s', '/c', commandLine], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      })
    };
  }

  return {
    command: 'code',
    result: spawnSync('code', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    })
  };
}

const probe = runCode(['--version']);
if (probe.result.error || probe.result.status !== 0) fail('VS Code CLI probe failed.');
console.log(`ghost-typing: VS Code CLI ${probe.command}`);
console.log(`ghost-typing: source      ${expected}`);

const uninstall = runCode(['--uninstall-extension', extensionId]);
if (uninstall.result.stdout) process.stdout.write(uninstall.result.stdout);
if (uninstall.result.stderr) process.stderr.write(uninstall.result.stderr);

const install = runCode(['--install-extension', vsix, '--force']);
if (install.result.stdout) process.stdout.write(install.result.stdout);
if (install.result.stderr) process.stderr.write(install.result.stderr);
if (install.result.error || install.result.status !== 0) fail('extension install failed.');

const list = runCode(['--list-extensions', '--show-versions']);
if (list.result.error || list.result.status !== 0) fail('could not verify installed extension.');

const installed = String(list.result.stdout || '')
  .split(/\r?\n/)
  .find(line => line.toLowerCase().startsWith(`${extensionId}@`.toLowerCase()));

if (installed !== expected) {
  fail(`install verification failed. Expected ${expected}, got ${installed || 'not installed'}.`);
}

console.log(`ghost-typing: verified    ${installed}`);
