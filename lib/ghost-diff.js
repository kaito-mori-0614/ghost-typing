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
  const scaffoldLines = targetLines.map((line, index) => inputLines.has(index) ? '' : line);
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

module.exports = {
  normalizeText,
  splitText,
  joinText,
  inputLinesFromUnifiedDiff,
  scaffoldForTarget,
  mismatchRanges,
  firstMismatchIndex
};
