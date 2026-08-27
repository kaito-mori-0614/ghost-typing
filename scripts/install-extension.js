const { spawnSync } = require('node:child_process');
const { candidateCommands } = require('../lib/vscode-launcher');

for (const command of candidateCommands()) {
  const result = spawnSync(command, ['--install-extension', 'ghost-typing.vsix', '--force'], {
    stdio: 'inherit',
    shell: false,
    windowsHide: false
  });
  if (!result.error && result.status === 0) {
    console.log('ghost-typing: VS Code extension 0.1.1 installed.');
    process.exit(0);
  }
}

console.error('ghost-typing: could not find a working VS Code command.');
process.exit(1);
