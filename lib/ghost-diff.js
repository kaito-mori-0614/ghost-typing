function splitLinesKeepEnds(text) {
  const matches = text.match(/.*(?:\n|$)/g) || [];
  if (matches.length && matches[matches.length - 1] === '') matches.pop();
  return matches;
}

function firstChange(current, target) {
  if (current === target) return null;

  const currentLines = splitLinesKeepEnds(current);
  const targetLines = splitLinesKeepEnds(target);
  let line = 0;
  let currentOffset = 0;
  let targetOffset = 0;

  while (line < currentLines.length && line < targetLines.length && currentLines[line] === targetLines[line]) {
    currentOffset += currentLines[line].length;
    targetOffset += targetLines[line].length;
    line += 1;
  }

  let currentEnd = currentLines.length - 1;
  let targetEnd = targetLines.length - 1;
  let commonSuffixLength = 0;

  while (currentEnd >= line && targetEnd >= line && currentLines[currentEnd] === targetLines[targetEnd]) {
    commonSuffixLength += currentLines[currentEnd].length;
    currentEnd -= 1;
    targetEnd -= 1;
  }

  const removedText = current.slice(currentOffset, current.length - commonSuffixLength);
  const addedText = target.slice(targetOffset, target.length - commonSuffixLength);

  return {
    currentOffset,
    targetOffset,
    removedText,
    addedText
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
