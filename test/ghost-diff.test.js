const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inputLinesFromUnifiedDiff,
  scaffoldForTarget,
  mismatchRanges,
  firstMismatchIndex
} = require('../lib/ghost-diff');

test('maps every added target line from a zero-context git diff', () => {
  const diff = [
    'diff --git a/a.v b/a.v',
    '--- a/a.v',
    '+++ b/a.v',
    '@@ -2,2 +2,3 @@',
    '-old_a',
    '-old_b',
    '+new_a',
    '+new_b',
    '+new_c',
    '@@ -10,0 +12,1 @@',
    '+tail'
  ].join('\n');

  const lines = inputLinesFromUnifiedDiff(diff);
  assert.deepEqual([...lines.entries()], [
    [1, 'new_a'],
    [2, 'new_b'],
    [3, 'new_c'],
    [11, 'tail']
  ]);
});

test('builds a target-shaped scaffold and blanks only typing lines', () => {
  const inputLines = new Map([[1, 'new_a'], [3, 'new_c']]);
  const scaffold = scaffoldForTarget('keep\nnew_a\nkeep2\nnew_c\n', inputLines);
  assert.equal(scaffold.text, 'keep\n\nkeep2\n\n');
  assert.deepEqual(scaffold.targetLines, ['keep', 'new_a', 'keep2', 'new_c', '']);
});

test('finds contiguous wrong-character ranges without flagging missing suffix', () => {
  assert.deepEqual(mismatchRanges('.REG_RX', '.REG_ROW'), [{ start: 6, end: 7 }]);
  assert.deepEqual(mismatchRanges('abcZZx', 'abcde'), [{ start: 3, end: 6 }]);
  assert.deepEqual(mismatchRanges('abc', 'abcdef'), []);
});

test('finds first mismatch or the first missing/extra character', () => {
  assert.equal(firstMismatchIndex('abc', 'abcdef'), 3);
  assert.equal(firstMismatchIndex('abX', 'abc'), 2);
  assert.equal(firstMismatchIndex('abcd', 'abc'), 3);
  assert.equal(firstMismatchIndex('abc', 'abc'), -1);
});

test('treats target lines beginning with plus characters as additions inside a hunk', () => {
  const diff = [
    'diff --git a/a.v b/a.v',
    '--- a/a.v',
    '+++ b/a.v',
    '@@ -0,0 +1,1 @@',
    '+++define FOO'
  ].join('\n');
  assert.deepEqual([...inputLinesFromUnifiedDiff(diff).entries()], [[0, '++define FOO']]);
});
