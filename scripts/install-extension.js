const { spawnSync } = require('node:child_process');

const extensionId = 'kaito-mori-0614.ghost-typing';
const expectedVersion = '0.1.3';

function run(args) {
  return spawnSync('code', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: false
  });
}

run(['--uninstall-extension', extensionId]);

const install = run(['--install-extension', 'ghost-typing.vsix', '--force']);
if (install.stdout) process.stdout.write(install.stdout);
if (install.stderr) process.stderr.write(install.stderr);
if (install.error || install.status !== 0) {
  console.error('ghost-typing: extension install failed.');
  process.exit(1);
}

const list = run(['--list-extensions', '--show-versions']);
const installed = String(list.stdout || '')
  .split(/\r?\n/)
  .find(line => line.toLowerCase().startsWith(`${extensionId}@`.toLowerCase()));

if (installed !== `${extensionId}@${expectedVersion}`) {
  console.error(`ghost-typing: expected ${extensionId}@${expectedVersion}, got ${installed || 'not installed'}`);
  process.exit(2);
}

console.log(`ghost-typing: verified ${installed}`);
