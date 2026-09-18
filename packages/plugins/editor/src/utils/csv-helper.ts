import type * as monacoType from 'monaco-editor';

export interface CsvCellToken {
  value: string;
  raw: string;
  startCol: number; // 1-indexed for Monaco
  endCol: number;   // 1-indexed for Monaco
}

export interface CsvLineTokens {
  lineNumber: number;
  cells: CsvCellToken[];
  delimiters: { col: number; length: number }[];
}

/**
 * Detect the most likely delimiter from sample lines (, ; \t |).
 */
export function detectDelimiter(text: string): string {
  const candidates = [',', '\t', ';', '|'];
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0).slice(0, 20);

  if (lines.length === 0) return ',';

  let bestDelimiter = ',';
  let maxScore = -1;

  for (const delim of candidates) {
    const counts: number[] = [];

    for (const line of lines) {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (!inQuotes && char === delim) {
          count++;
        }
      }
      counts.push(count);
    }

    // Consistency: all lines have roughly the same number of delimiters > 0
    const nonZeroCounts = counts.filter(c => c > 0);
    if (nonZeroCounts.length > 0) {
      const firstCount = nonZeroCounts[0];
      const matchCount = nonZeroCounts.filter(c => c === firstCount).length;
      // Score favors higher consistency across lines, then higher count
      const score = (matchCount / lines.length) * 100 + firstCount;
      if (score > maxScore) {
        maxScore = score;
        bestDelimiter = delim;
      }
    }
  }

  return bestDelimiter;
}

/**
 * Parses a single CSV line according to RFC 4180 rules, returning tokens with 1-indexed column positions.
 */
export function parseCsvLine(line: string, delimiter: string, lineNumber: number = 1): CsvLineTokens {
  const cells: CsvCellToken[] = [];
  const delimiters: { col: number; length: number }[] = [];

  let colStart = 0; // 0-indexed character index
  let currentRaw = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentRaw += '""';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
        currentRaw += char;
        i++;
        continue;
      }
    }

    if (!inQuotes && line.substring(i, i + delimiter.length) === delimiter) {
      // Cell finished
      cells.push({
        value: unquote(currentRaw.trim()),
        raw: currentRaw,
        startCol: colStart + 1,
        endCol: i + 1
      });
      delimiters.push({ col: i + 1, length: delimiter.length });

      i += delimiter.length;
      colStart = i;
      currentRaw = '';
      continue;
    }

    currentRaw += char;
    i++;
  }

  // Add the last cell
  cells.push({
    value: unquote(currentRaw.trim()),
    raw: currentRaw,
    startCol: colStart + 1,
    endCol: line.length + 1
  });

  return {
    lineNumber,
    cells,
    delimiters
  };
}

/**
 * Remove surrounding quotes and unescape inner double quotes.
 */
function unquote(val: string): string {
  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    return val.slice(1, -1).replace(/""/g, '"');
  }
  return val;
}

/**
 * Re-quote if cell contains delimiter, quote, or newline.
 */
function reQuoteIfNeeded(val: string, delimiter: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }
  if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Computes visual display width of a Unicode character code point in monospace font.
 * CJK fullwidth characters, ideographs, Hiragana, Katakana, and Hangul occupy 2 columns.
 * Halfwidth Katakana and standard ASCII occupy 1 column.
 */
export function getCharVisualWidth(codePoint: number): number {
  if (codePoint < 32 || (codePoint >= 0x7F && codePoint < 0xA0)) {
    return 0;
  }
  // Halfwidth Katakana: U+FF61 to U+FF9F -> width 1
  if (codePoint >= 0xFF61 && codePoint <= 0xFF9F) {
    return 1;
  }
  // Fullwidth and East Asian Wide characters
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115F) || // Hangul Jamo
    (codePoint >= 0x2E80 && codePoint <= 0x9FFF) || // CJK Radicals, CJK Unified Ideographs
    (codePoint >= 0xA960 && codePoint <= 0xA97F) || // Hangul Jamo Extended-A
    (codePoint >= 0xAC00 && codePoint <= 0xD7AF) || // Hangul Syllables
    (codePoint >= 0xD7B0 && codePoint <= 0xD7FF) || // Hangul Jamo Extended-B
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) || // CJK Compatibility Ideographs
    (codePoint >= 0xFE10 && codePoint <= 0xFE19) || // Vertical forms
    (codePoint >= 0xFE30 && codePoint <= 0xFE6F) || // CJK Compatibility Forms
    (codePoint >= 0xFF01 && codePoint <= 0xFF60) || // Fullwidth Forms (ASCII & punctuation)
    (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) || // Fullwidth symbol variants
    (codePoint >= 0x20000 && codePoint <= 0x2FFFD) ||
    (codePoint >= 0x30000 && codePoint <= 0x3FFFD)
  ) {
    return 2;
  }
  return 1;
}

/**
 * Computes total visual display width of a string in monospace font.
 */
export function getStringVisualWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const codePoint = char.codePointAt(0) || 0;
    width += getCharVisualWidth(codePoint);
  }
  return width;
}

/**
 * Pads string with spaces to reach target visual column width.
 */
export function padVisualEnd(str: string, targetVisualWidth: number): string {
  const currentVisualWidth = getStringVisualWidth(str);
  const diff = targetVisualWidth - currentVisualWidth;
  if (diff <= 0) return str;
  return str + ' '.repeat(diff);
}

/**
 * Align columns so that every column lines up vertically like a table.
 * Uses visual character width to support CJK/Japanese fullwidth characters.
 */
export function alignCsv(text: string, customDelimiter?: string): { text: string; delimiter: string } {
  const delimiter = customDelimiter || detectDelimiter(text);
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length === 0) return { text, delimiter };

  // Parse all lines into cell strings
  const parsedRows: string[][] = [];
  const colVisualWidths: number[] = [];

  for (const line of rawLines) {
    if (!line.trim()) {
      parsedRows.push([]);
      continue;
    }
    const tokens = parseCsvLine(line, delimiter);
    const row = tokens.cells.map(c => c.raw.trim());
    parsedRows.push(row);

    for (let c = 0; c < row.length; c++) {
      const vWidth = getStringVisualWidth(row[c]);
      colVisualWidths[c] = Math.max(colVisualWidths[c] || 0, vWidth);
    }
  }

  // Rebuild aligned lines
  const alignedLines = parsedRows.map((row) => {
    if (row.length === 0) return '';
    return row.map((cell, idx) => {
      const targetWidth = colVisualWidths[idx] || 0;
      // Don't pad the very last column
      if (idx === row.length - 1) return cell;
      return padVisualEnd(cell, targetWidth);
    }).join(` ${delimiter} `);
  });

  return {
    text: alignedLines.join('\n'),
    delimiter
  };
}

/**
 * Compact aligned CSV back to unpadded standard CSV.
 */
export function compactCsv(text: string, customDelimiter?: string): { text: string; delimiter: string } {
  const delimiter = customDelimiter || detectDelimiter(text);
  const rawLines = text.split(/\r?\n/);

  const compactedLines = rawLines.map(line => {
    if (!line.trim()) return '';
    const tokens = parseCsvLine(line, delimiter);
    return tokens.cells.map(c => {
      const trimmed = c.raw.trim();
      return reQuoteIfNeeded(trimmed, delimiter);
    }).join(delimiter);
  });

  return {
    text: compactedLines.join('\n'),
    delimiter
  };
}

/**
 * Check if the CSV appears to be already aligned.
 */
export function isCsvAligned(text: string, delimiter: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 10);
  if (lines.length < 2) return false;
  // If lines consistently use " , " or padding spaces before/after delimiter
  const spacedDelim = ` ${delimiter} `;
  let count = 0;
  for (const line of lines) {
    if (line.includes(spacedDelim)) count++;
  }
  return count >= Math.ceil(lines.length * 0.7);
}

/**
 * Generates Monaco editor decorations for Rainbow CSV columns.
 */
export function generateRainbowDecorations(
  model: monacoType.editor.ITextModel,
  delimiter: string,
  monacoInstance: typeof monacoType,
  maxLines: number = 3000
): monacoType.editor.IModelDeltaDecoration[] {
  const decorations: monacoType.editor.IModelDeltaDecoration[] = [];
  const lineCount = Math.min(model.getLineCount(), maxLines);

  // Extract header row if first line exists
  let headers: string[] = [];
  if (lineCount > 0) {
    const firstLine = model.getLineContent(1);
    if (firstLine.trim()) {
      const headerTokens = parseCsvLine(firstLine, delimiter, 1);
      headers = headerTokens.cells.map(c => c.value);
    }
  }

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineContent = model.getLineContent(lineNumber);
    if (!lineContent.trim()) continue;

    const parsed = parseCsvLine(lineContent, delimiter, lineNumber);

    // Decorate each cell
    parsed.cells.forEach((cell, colIdx) => {
      if (cell.endCol <= cell.startCol) return;

      const colClass = `csv-col-${colIdx % 10}`;
      const headerName = headers[colIdx] ? ` (\`${headers[colIdx]}\`)` : '';
      const hoverValue = lineNumber === 1
        ? `**[Header Column ${colIdx + 1}]** \`${cell.value || '(empty)'}\``
        : `**[Column ${colIdx + 1}]**${headerName}: \`${cell.value || '(empty)'}\``;

      decorations.push({
        range: new monacoInstance.Range(lineNumber, cell.startCol, lineNumber, cell.endCol),
        options: {
          inlineClassName: colClass,
          hoverMessage: { value: hoverValue }
        }
      });
    });

    // Decorate delimiters (subtle dimmed style)
    parsed.delimiters.forEach(delim => {
      decorations.push({
        range: new monacoInstance.Range(lineNumber, delim.col, lineNumber, delim.col + delim.length),
        options: {
          inlineClassName: 'csv-delim'
        }
      });
    });
  }

  return decorations;
}
