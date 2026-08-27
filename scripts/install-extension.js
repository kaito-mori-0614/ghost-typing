const { spawnSync } = require('node:child_process');
const { candidateCommands } = require('../lib/vscode-launcher');

const extensionId = 'kaito-mori-0614.ghost-typing';
const expectedVersion = '0.1.2';

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: false
  });
}

for (const command of candidateCommands()) {
  const probe = run(command, ['--version']);
  if (probe.error || probe.status !== 0) continue;

  console.log(`ghost-typing: using VS Code CLI: ${command}`);

  run(command, ['--uninstall-extension', extensionId]);

  const install = run(command, ['--install-extension', 'ghost-typing.vsix', '--force']);
  if (install.stdout) process.stdout.write(install.stdout);
  if (install.stderr) process.stderr.write(install.stderr);
  if (install.error || install.status !== 0) continue;

  const list = run(command, ['--list-extensions', '--show-versions']);
  const installed = String(list.stdout || '')
    .split(/\r?\n/)
    .find(line => line.toLowerCase().startsWith(`${extensionId}@`.toLowerCase()));

  if (installed === `${extensionId}@${expectedVersion}`) {
    console.log(`ghost-typing: verified ${installed}`);
    process.exit(0);
  }

  console.error(`ghost-typing: install verification failed. Expected ${extensionId}@${expectedVersion}, got ${installed || 'not installed'}`);
  process.exit(2);
}

console.error('ghost-typing: could not find a working VS Code CLI.');
process.exit(1);
