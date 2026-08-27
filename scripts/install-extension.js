const { execFileSync, execSync } = require('node:child_process');
const path = require('node:path');

const pkg = require('../package.json');
const extensionId = `${pkg.publisher}.${pkg.name}`;
const expected = `${extensionId}@${pkg.version}`;
const vsix = path.resolve(__dirname, '..', 'ghost-typing.vsix');

function fail(message, error) {
  console.error(`ghost-typing: ${message}`);
  if (error?.stdout) process.stderr.write(String(error.stdout));
  if (error?.stderr) process.stderr.write(String(error.stderr));
  process.exit(1);
}

function runCode(args) {
  try {
    if (process.platform === 'win32') {
      const quote = value => `"${String(value).replace(/"/g, '""')}"`;
      const command = ['code', ...args].map(quote).join(' ');
      return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    }
    return execFileSync('code', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw error;
  }
}

console.log(`ghost-typing: source ${expected}`);

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
