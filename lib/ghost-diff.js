function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffixLength(a, b, prefixLength) {
  const max = Math.min(a.length, b.length) - prefixLength;
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

function firstChange(current, target) {
  if (current === target) return null;

  const prefix = commonPrefixLength(current, target);
  const suffix = commonSuffixLength(current, target, prefix);
  const currentMiddle = current.slice(prefix, current.length - suffix);
  const targetMiddle = target.slice(prefix, target.length - suffix);

  // Keep one editing step small: stop at the next newline in either side.
  const currentBreak = currentMiddle.indexOf('\n');
  const targetBreak = targetMiddle.indexOf('\n');
  const currentEnd = currentBreak >= 0 ? currentBreak + 1 : currentMiddle.length;
  const targetEnd = targetBreak >= 0 ? targetBreak + 1 : targetMiddle.length;

  return {
    currentOffset: prefix,
    targetOffset: prefix,
    removedText: currentMiddle.slice(0, currentEnd),
    addedText: targetMiddle.slice(0, targetEnd)
  };
}

function remainingInsertedTextAtCursor(current, target, cursorOffset) {
  const change = firstChange(current, target);
  if (!change) return null;
  if (change.removedText.length > 0) return null;
  if (cursorOffset !== change.currentOffset) return null;
  return change.addedText || null;
}

module.exports = {
  firstChange,
  remainingInsertedTextAtCursor
};
