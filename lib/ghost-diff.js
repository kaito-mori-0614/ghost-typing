function normalizeText(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

function splitText(text) {
  const normalized = normalizeText(text);
  return {
    lines: normalized.split('\n'),
    finalNewline: normalized.endsWith('\n')
  };
}

function joinText(lines) {
  return lines.join('\n');
}

function leadingWhitespace(text) {
  return (String(text ?? '').match(/^[ \t]*/) || [''])[0];
}

function inputLinesFromUnifiedDiff(diffText) {
  const inputLines = new Map();
  const lines = normalizeText(diffText).split('\n');
  let targetLine = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      targetLine = match ? Number(match[1]) - 1 : null;
      continue;
    }

    if (targetLine == null) continue;
    if (line.startsWith('diff --git ') || line.startsWith('@@')) {
      targetLine = null;
      continue;
    }
    if (line.startsWith('\\ No newline at end of file')) continue;

    if (line.startsWith('+')) {
      inputLines.set(targetLine, line.slice(1));
      targetLine += 1;
      continue;
    }
    if (line.startsWith('-')) continue;
    if (line.startsWith(' ')) {
      targetLine += 1;
      continue;
    }

    if (line && !line.startsWith('index ')) targetLine = null;
  }

  return inputLines;
}

function scaffoldForTarget(targetText, inputLines) {
  const { lines: targetLines, finalNewline } = splitText(targetText);
  const scaffoldLines = targetLines.map((line, index) => (
    inputLines.has(index) ? leadingWhitespace(line) : line
  ));
  return {
    targetLines,
    finalNewline,
    text: joinText(scaffoldLines)
  };
}

function mismatchRanges(actual, expected) {
  const ranges = [];
  const limit = actual.length;
  let start = null;

  for (let i = 0; i < limit; i += 1) {
    const mismatch = i >= expected.length || actual[i] !== expected[i];
    if (mismatch && start == null) start = i;
    if (!mismatch && start != null) {
      ranges.push({ start, end: i });
      start = null;
    }
  }

  if (start != null) ranges.push({ start, end: limit });
  return ranges;
}

function firstMismatchIndex(actual, expected) {
  const limit = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < limit && actual[i] === expected[i]) i += 1;
  if (i < limit) return i;
  if (actual.length !== expected.length) return i;
  return -1;
}

function remainingTarget(actual, expected) {
  const current = String(actual ?? '');
  const target = String(expected ?? '');
  return target.startsWith(current) ? target.slice(current.length) : '';
}

function normalizedTabSize(tabSize) {
  const value = Number(tabSize);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 4;
}

function visualColumn(text, tabSize = 4, startColumn = 0) {
  const size = normalizedTabSize(tabSize);
  let column = Math.max(0, Number(startColumn) || 0);
  for (const char of String(text ?? '')) {
    if (char === '\t') column += size - (column % size);
    else column += 1;
  }
  return column;
}

function ghostDisplayText(text, startColumn = 0, tabSize = 4) {
  const size = normalizedTabSize(tabSize);
  let column = Math.max(0, Number(startColumn) || 0);
  let result = '';

  for (const char of String(text ?? '')) {
    if (char === ' ') {
      result += '\u00a0';
      column += 1;
      continue;
    }
    if (char === '\t') {
      const width = size - (column % size);
      result += '\u00a0'.repeat(width);
      column += width;
      continue;
    }
    result += char;
    column += 1;
  }

  return result;
}

module.exports = {
  normalizeText,
  splitText,
  joinText,
  leadingWhitespace,
  inputLinesFromUnifiedDiff,
  scaffoldForTarget,
  mismatchRanges,
  firstMismatchIndex,
  remainingTarget,
  visualColumn,
  ghostDisplayText
};
