const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function candidateCommands() {
  if (process.platform !== 'win32') return ['code'];
  const local = process.env.LOCALAPPDATA;
  const pf = process.env.ProgramFiles;
  return [
    'code.cmd',
    local && path.join(local, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    local && path.join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'),
    pf && path.join(pf, 'Microsoft VS Code', 'bin', 'code.cmd'),
    pf && path.join(pf, 'Microsoft VS Code', 'Code.exe')
  ].filter(Boolean);
}

function launchNewWindow(cwd) {
  const args = ['--new-window', cwd];
  for (const command of candidateCommands()) {
    if (command.includes(path.sep) && !fs.existsSync(command)) continue;
    const result = spawnSync(command, args, { stdio: 'inherit', shell: false, windowsHide: false });
    if (!result.error && result.status === 0) return true;
  }
  return false;
}

module.exports = { launchNewWindow, candidateCommands };
