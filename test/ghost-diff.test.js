const test = require('node:test');
const assert = require('node:assert/strict');
const { firstChange, remainingInsertedTextAtCursor } = require('../lib/ghost-diff');

test('finds inserted block', () => {
  const current = 'a\nb\n';
  const target = 'a\nx\nb\n';
  const change = firstChange(current, target);
  assert.equal(change.currentOffset, 2);
  assert.equal(change.removedText, '');
  assert.equal(change.addedText, 'x\n');
});

test('returns ghost text only at insertion point', () => {
  const current = 'a\nb\n';
  const target = 'a\nx\nb\n';
  assert.equal(remainingInsertedTextAtCursor(current, target, 2), 'x\n');
  assert.equal(remainingInsertedTextAtCursor(current, target, 0), null);
});

test('marks replacement as removal plus addition', () => {
  const current = 'logic [1:0] a;\n';
  const target = 'logic [2:0] a;\n';
  const change = firstChange(current, target);
  assert.ok(change.removedText.length > 0);
  assert.ok(change.addedText.length > 0);
});
