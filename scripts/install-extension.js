const path = require('node:path');
const { resolveWindowsCodeLauncher, runCode } = require('../lib/vscode-cli');

const pkg = require('../package.json');
const extensionId = `${pkg.publisher}.${pkg.name}`;
const expected = `${extensionId}@${pkg.version}`;
const vsix = path.resolve(__dirname, '..', 'ghost-typing.vsix');

function fail(message, error) {
  console.error(`ghost-typing: ${message}`);
  if (error?.stdout) process.stderr.write(String(error.stdout));
  if (error?.stderr) process.stderr.write(String(error.stderr));
  if (error?.message && !error?.stderr) process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

console.log(`ghost-typing: source ${expected}`);

if (process.platform === 'win32') {
  try {
    const launcher = resolveWindowsCodeLauncher();
    console.log(`ghost-typing: VS Code CLI ${launcher.codeCmd}`);
  } catch (error) {
    fail('VS Code CLI discovery failed.', error);
  }
}

try {
  const output = runCode(['--install-extension', vsix, '--force']);
  if (output) process.stdout.write(output);
} catch (error) {
  fail('extension install failed.', error);
}

let list;
try {
  list = runCode(['--list-extensions', '--show-versions']);
} catch (error) {
  fail('could not verify installed extension.', error);
}

const installed = String(list || '')
  .split(/\r?\n/)
  .find(line => line.toLowerCase().startsWith(`${extensionId}@`.toLowerCase()));

if (installed !== expected) {
  fail(`install verification failed. Expected ${expected}, got ${installed || 'not installed'}.`);
}

console.log(`ghost-typing: verified ${installed}`);
console.log('ghost-typing: if VS Code is already open, run "Developer: Reload Window" once.');
