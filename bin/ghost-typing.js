#!/usr/bin/env node

const { execFileSync, spawnSync } = require('node:child_process');

function runGit(args, options = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: options.stdio || ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function fail(message) {
  console.error(`ghost-typing: ${message}`);
  process.exit(1);
}

function sanitizeTarget(target) {
  return target.replace(/^refs\/heads\//, '').replace(/^origin\//, '');
}

function resolveTarget(input) {
  const candidates = [input, `origin/${input}`];
  for (const candidate of candidates) {
    try {
      runGit(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {}
  }
  fail(`target branch not found: ${input}`);
}

function ensureClean() {
  const status = runGit(['status', '--porcelain']);
  if (status) {
    fail('working tree has uncommitted changes. Commit or stash them first.');
  }
}

function openCode() {
  const result = spawnSync('code', ['.'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.warn('ghost-typing: VS Code could not be opened automatically. Run `code .` manually.');
  }
}

function start(targetInput) {
  runGit(['rev-parse', '--is-inside-work-tree']);
  ensureClean();

  const sourceBranch = runGit(['branch', '--show-current']);
  if (!sourceBranch) fail('detached HEAD is not supported.');
  if (sourceBranch.startsWith('ghost-typing/')) {
    fail(`already on a ghost-typing branch: ${sourceBranch}`);
  }

  const targetRef = resolveTarget(targetInput);
  const targetName = sanitizeTarget(targetInput);
  const workBranch = `ghost-typing/${targetName}`;
  const base = runGit(['merge-base', sourceBranch, targetRef]);

  try {
    runGit(['show-ref', '--verify', '--quiet', `refs/heads/${workBranch}`]);
    fail(`branch already exists: ${workBranch}`);
  } catch (error) {
    if (String(error.message || '').includes('branch already exists')) throw error;
  }

  runGit(['switch', '-c', workBranch, base], { stdio: 'inherit' });

  console.log(`ghost-typing: target = ${targetRef}`);
  console.log(`ghost-typing: base   = ${base.slice(0, 12)}`);
  console.log(`ghost-typing: work   = ${workBranch}`);
  console.log('ghost-typing: opening VS Code...');
  openCode();
}

function status() {
  const branch = runGit(['branch', '--show-current']);
  if (!branch.startsWith('ghost-typing/')) {
    fail('current branch is not a ghost-typing branch.');
  }
  const target = branch.slice('ghost-typing/'.length);
  const targetRef = resolveTarget(target);
  const diff = runGit(['diff', '--stat', targetRef, '--', '.']);
  if (!diff) {
    console.log(`ghost-typing: current files match ${targetRef}`);
  } else {
    console.log(diff);
  }
}

function commit(message) {
  if (!message) fail('usage: ghost-typing commit "message"');
  const branch = runGit(['branch', '--show-current']);
  if (!branch.startsWith('ghost-typing/')) {
    fail('current branch is not a ghost-typing branch.');
  }
  const target = branch.slice('ghost-typing/'.length);
  const targetRef = resolveTarget(target);

  const names = runGit(['diff', '--name-only', targetRef, '--', '.']);
  if (names) {
    console.error('ghost-typing: target does not match yet. Remaining files:');
    console.error(names);
    process.exit(2);
  }

  runGit(['add', '-A'], { stdio: 'inherit' });
  runGit(['commit', '-m', message], { stdio: 'inherit' });
}

const args = process.argv.slice(2);
if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
  console.log(`ghost-typing\n\nUsage:\n  ghost-typing <target-branch>\n  ghost-typing status\n  ghost-typing commit "message"\n\nExample:\n  ghost-typing ai-output`);
  process.exit(args.length ? 0 : 1);
}

try {
  if (args[0] === 'status') status();
  else if (args[0] === 'commit') commit(args.slice(1).join(' '));
  else start(args[0]);
} catch (error) {
  fail(error.message);
}
