const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inputLinesFromUnifiedDiff,
  scaffoldForTarget,
  mismatchRanges,
  firstMismatchIndex,
  remainingTarget,
  visualColumn,
  ghostDisplayText
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

test('builds a target-shaped scaffold and preserves leading indentation on typing lines', () => {
  const inputLines = new Map([[1, '  new_a'], [3, '\tnew_c']]);
  const scaffold = scaffoldForTarget('keep\n  new_a\nkeep2\n\tnew_c\n', inputLines);
  assert.equal(scaffold.text, 'keep\n  \nkeep2\n\t\n');
  assert.deepEqual(scaffold.targetLines, ['keep', '  new_a', 'keep2', '\tnew_c', '']);
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

test('advances ghost text only for an exact typed prefix', () => {
  assert.equal(remainingTarget('', ' parameter'), ' parameter');
  assert.equal(remainingTarget(' ', ' parameter'), 'parameter');
  assert.equal(remainingTarget('p', ' parameter'), '');
  assert.equal(remainingTarget(' paraX', ' parameter'), '');
  assert.equal(remainingTarget(' parameter', ' parameter'), '');
});

test('renders spaces and tabs with stable visible width for decorations', () => {
  assert.equal(visualColumn('ab\t', 4), 4);
  assert.equal(visualColumn('abcd\t', 4), 8);
  assert.equal(ghostDisplayText('  x', 0, 4), '\u00a0\u00a0x');
  assert.equal(ghostDisplayText('\tx', 0, 4), '\u00a0\u00a0\u00a0\u00a0x');
  assert.equal(ghostDisplayText('\tx', 2, 4), '\u00a0\u00a0x');
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
