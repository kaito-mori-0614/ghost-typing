const Diff = require('diff');

function buildSegments(current, target) {
  return Diff.diffLines(current, target);
}

function firstChange(current, target) {
  const parts = buildSegments(current, target);
  let currentOffset = 0;
  let targetOffset = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (!part.added && !part.removed) {
      currentOffset += part.value.length;
      targetOffset += part.value.length;
      continue;
    }

    let removedText = '';
    let addedText = '';
    const startCurrentOffset = currentOffset;
    const startTargetOffset = targetOffset;

    while (i < parts.length && (parts[i].added || parts[i].removed)) {
      const p = parts[i];
      if (p.removed) {
        removedText += p.value;
        currentOffset += p.value.length;
      } else if (p.added) {
        addedText += p.value;
        targetOffset += p.value.length;
      }
      i += 1;
    }

    return {
      currentOffset: startCurrentOffset,
      targetOffset: startTargetOffset,
      removedText,
      addedText
    };
  }

  return null;
}

function remainingInsertedTextAtCursor(current, target, cursorOffset) {
  const change = firstChange(current, target);
  if (!change) return null;
  if (change.removedText.length > 0) return null;
  if (cursorOffset !== change.currentOffset) return null;
  return change.addedText || null;
}

module.exports = {
  buildSegments,
  firstChange,
  remainingInsertedTextAtCursor
};
