const { execFileSync } = require('node:child_process');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fail(message) {
  console.error(`ghost-typing: ${message}`);
  process.exit(1);
}

const branch = git(['branch', '--show-current']);
if (branch !== 'main') fail(`install must run from main (current: ${branch || 'detached HEAD'}).`);

const dirty = git(['status', '--porcelain']);
if (dirty) fail(`working tree is not clean:\n${dirty}`);

try {
  git(['fetch', 'origin', 'main']);
} catch {
  fail('could not fetch origin/main. Check network/VPN and retry.');
}

const head = git(['rev-parse', 'HEAD']);
const remote = git(['rev-parse', 'origin/main']);
if (head !== remote) {
  fail('local main is not identical to origin/main. Run: git pull --ff-only origin main');
}

const pkg = require('../package.json');
console.log(`ghost-typing: source version ${pkg.version}`);
console.log(`ghost-typing: source commit  ${head.slice(0, 12)}`);
