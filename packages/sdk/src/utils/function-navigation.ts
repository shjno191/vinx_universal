/**
 * Shared Function Navigation Utility for Editor & Compare Tabs
 * Handles:
 * 1. Extracting function symbols with their scope ranges (startLine, endLine).
 * 2. Determining whether the cursor is at function definition or inside function body.
 * 3. Finding all usage references of a function within the text.
 */

export interface FunctionSymbolItem {
  name: string;
  line: number;       // 1-based definition line
  column: number;     // 1-based column of function name
  endLine: number;    // 1-based line where function body ends
  preview: string;    // Trimmed code preview of definition line
}

export interface FunctionUsageItem {
  name: string;
  line: number;       // 1-based line of usage
  column: number;     // 1-based column of usage
  preview: string;    // Trimmed code preview of usage line
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detects the script or programming language from file name or code content heuristics.
 */
export function detectScriptLanguage(content: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'java') return 'java';
    if (ext === 'py') return 'python';
    if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') return 'javascript';
    if (ext === 'csv') return 'csv';
    if (ext === 'sql') return 'sql';
    if (ext === 'boi' || ext === 'script') return 'boi-script';
  }
  // Heuristic inspection from content
  if (/^\s*(?:package\s+[\w.]+;|import\s+[\w.]+;|public\s+(?:class|interface|enum)\b)/m.test(content)) {
    return 'java';
  }
  if (/^\s*def\s+[a-zA-Z0-9_]+\s*\(/m.test(content) || /^\s*import\s+\w+\s*$/m.test(content)) {
    return 'python';
  }
  if (/(?:function\s+[a-zA-Z0-9_]+\s*\(|endfunction)/i.test(content)) {
    return 'boi-script';
  }
  return 'javascript';
}

/**
 * Calculates the ending line of a function starting at startLineIndex (0-based).
 */
function findFunctionEndLine(
  lines: string[],
  startLineIndex: number,
  isPython: boolean,
  isBoiScript: boolean
): number {
  const totalLines = lines.length;
  const startLine = lines[startLineIndex] || '';

  // 1. Python Indentation-based scope
  if (isPython) {
    const baseIndent = startLine.search(/\S/);
    if (baseIndent === -1) return startLineIndex + 1;

    for (let i = startLineIndex + 1; i < totalLines; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const lineIndent = line.search(/\S/);
      if (lineIndent <= baseIndent) {
        return i; // Previous line was the last line of function
      }
    }
    return totalLines;
  }

  // 2. BOI script `function ... endfunction` without braces
  if (isBoiScript && !startLine.includes('{')) {
    for (let i = startLineIndex + 1; i < totalLines; i++) {
      const trimmed = lines[i].trim().toLowerCase();
      if (/^endfunction\b/i.test(trimmed)) {
        return i + 1;
      }
      // If a new function begins before endfunction, stop before it
      if (/^function\s+[a-zA-Z0-9_]+/i.test(trimmed)) {
        return i;
      }
    }
  }

  // 3. Brace-based scoping (JS, TS, Java, C#, BOI script with braces, etc.)
  let openBraces = 0;
  let hasOpened = false;
  let inQuote: string | null = null;

  for (let i = startLineIndex; i < totalLines; i++) {
    const line = lines[i];
    if (!line.includes('{') && !line.includes('}') && !inQuote) {
      continue;
    }

    let checkLine = line;
    const commentIdx = checkLine.indexOf('//');
    if (commentIdx !== -1 && !inQuote) {
      checkLine = checkLine.substring(0, commentIdx);
      if (!checkLine.includes('{') && !checkLine.includes('}')) {
        continue;
      }
    }

    for (let charIdx = 0; charIdx < checkLine.length; charIdx++) {
      const ch = checkLine[charIdx];
      if (inQuote) {
        if (ch === '\\') {
          charIdx++; // Skip escaped character
        } else if (ch === inQuote) {
          inQuote = null;
        }
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inQuote = ch;
        continue;
      }

      if (ch === '{') {
        openBraces++;
        hasOpened = true;
      } else if (ch === '}') {
        if (openBraces > 0) {
          openBraces--;
          if (openBraces === 0 && hasOpened) {
            return i + 1;
          }
        }
      }
    }

    // If we've seen openBraces return to 0 after opening, function ends here
    if (hasOpened && openBraces === 0) {
      return i + 1;
    }

    // Single-line quotes (' or ") cannot span across multiple lines in standard languages
    if (inQuote === '"' || inQuote === "'") {
      inQuote = null;
    }
  }

  // Fallback: If no explicit closing found, search for next function definition
  for (let i = startLineIndex + 1; i < totalLines; i++) {
    const trimmed = lines[i].trim();
    if (
      /^\s*function\s+[a-zA-Z0-9_]+/i.test(trimmed) ||
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+[a-zA-Z0-9_$]+/i.test(trimmed) ||
      /^\s*def\s+[a-zA-Z0-9_]+/i.test(trimmed)
    ) {
      return i;
    }
  }

  return totalLines;
}

/**
 * Extracts all function definitions from code content with their line ranges.
 */
export function extractFunctionsFromContent(
  content: string,
  lang?: string
): FunctionSymbolItem[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const results: FunctionSymbolItem[] = [];

  const normalizedLang = (lang || '').toLowerCase();
  const isPython = normalizedLang.includes('py') || normalizedLang.includes('python');
  const isBoiScript = normalizedLang.includes('boi') || normalizedLang.includes('script');

  const boiRegex = /^\s*function\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]*)\))?/i;
  const jsFuncRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([a-zA-Z0-9_$]+)\s*\(/;
  const jsArrowRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/;
  const pyRegex = /^\s*def\s+([a-zA-Z0-9_]+)\s*\(/;
  // Java / C# method with modifiers, return type, throws clause (no overlapping whitespace to avoid ReDoS)
  const javaRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[a-zA-Z0-9_<>\[\],.?]+\s+([a-zA-Z0-9_$]+)\s*\([^;{}]*\)(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;
  // Java multiline signature start (parameter list spans across lines)
  const javaMultilineStartRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[a-zA-Z0-9_<>\[\],.?]+\s+([a-zA-Z0-9_$]+)\s*\([^)]*$/;
  // Java constructor (no return type)
  const javaConstructorRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:public|protected|private)\s+([A-Z][a-zA-Z0-9_$]*)\s*\([^;{}]*\)(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;
  const sqlRegex = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+([a-zA-Z0-9_]+)/i;
  const methodRegex = /^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)+([a-zA-Z0-9_$]+)\s*\([^;{}]*\)\s*(?::\s*[^;{]+)?(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;

  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      continue;
    }

    let matchName: string | null = null;
    let col = 1;

    let m = boiRegex.exec(rawLine);
    if (m) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = jsFuncRegex.exec(rawLine))) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = jsArrowRegex.exec(rawLine))) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = pyRegex.exec(rawLine))) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = javaRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = javaMultilineStartRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) {
      // Check if subsequent lines close the parameter list and contain '{'
      let hasClosedParen = false;
      let foundHeaderEnd = false;
      for (let lookahead = i + 1; lookahead < Math.min(lines.length, i + 35); lookahead++) {
        const l = lines[lookahead].trim();
        if (l.includes(')')) hasClosedParen = true;
        if (hasClosedParen && l.includes('{')) {
          foundHeaderEnd = true;
          break;
        }
        if (l.includes(';')) break;
      }
      if (foundHeaderEnd) {
        matchName = m[1];
        col = rawLine.indexOf(m[1]) + 1;
      }
    } else if ((m = javaConstructorRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = sqlRegex.exec(rawLine))) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    } else if ((m = methodRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch|return)\b/.test(trimmed)) {
      matchName = m[1];
      col = rawLine.indexOf(m[1]) + 1;
    }

    if (matchName && !['if', 'while', 'for', 'switch', 'catch', 'function', 'return', 'new', 'throw', 'class', 'interface', 'enum'].includes(matchName)) {
      const key = `${matchName}:${i + 1}`;
      if (!seen.has(key)) {
        seen.add(key);
        const endLine = findFunctionEndLine(lines, i, isPython, isBoiScript);
        results.push({
          name: matchName,
          line: i + 1,
          column: col > 0 ? col : 1,
          endLine: Math.max(endLine, i + 1),
          preview: trimmed
        });
      }
    }
  }

  return results;
}

/**
 * Finds all usages / call sites of a function in the given content.
 * Excludes the definition line itself and comments.
 */
export function findFunctionUsages(
  content: string,
  funcName: string,
  defLine: number
): FunctionUsageItem[] {
  const trimmedName = (funcName || '').trim();
  if (!content || !trimmedName) return [];
  const lines = content.split(/\r?\n/);
  const results: FunctionUsageItem[] = [];

  // Match identifier boundary safely
  const isWordStart = /^\w/.test(trimmedName);
  const isWordEnd = /\w$/.test(trimmedName);
  const prefix = isWordStart ? '\\b' : '(?:^|\\s|[^a-zA-Z0-9_$])';
  const suffix = isWordEnd ? '\\b' : '(?=$|\\s|[^a-zA-Z0-9_$])';
  const wordPattern = new RegExp(`${prefix}${escapeRegex(trimmedName)}${suffix}`);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (lineNum === defLine) continue; // Exclude the declaration itself

    const rawLine = lines[i];
    if (!rawLine.includes(trimmedName)) continue; // Fast skip

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      continue;
    }

    // Ignore inline comments before matching
    let checkLine = rawLine;
    const commentIdx = checkLine.indexOf('//');
    if (commentIdx !== -1) {
      checkLine = checkLine.substring(0, commentIdx);
    }

    const match = wordPattern.exec(checkLine);
    if (match) {
      const matchCol = checkLine.indexOf(trimmedName) + 1;
      results.push({
        name: trimmedName,
        line: lineNum,
        column: matchCol > 0 ? matchCol : match.index + 1,
        preview: trimmed
      });
    }
  }

  return results;
}

/**
 * Helper to test if a line is a function definition without parsing entire file.
 */
function testLineForFunctionDefinition(rawLine: string, lines: string[], lineIdx: number): { name: string; col: number } | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
    return null;
  }

  // Fast check: All supported function definitions must contain '(' or '=>' or start with 'function'
  if (!trimmed.includes('(') && !trimmed.includes('=>') && !/^\s*function\b/i.test(trimmed)) {
    return null;
  }

  const boiRegex = /^\s*function\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]*)\))?/i;
  const jsFuncRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([a-zA-Z0-9_$]+)\s*\(/;
  const jsArrowRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/;
  const pyRegex = /^\s*def\s+([a-zA-Z0-9_]+)\s*\(/;
  const javaRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[a-zA-Z0-9_<>\[\],.?]+\s+([a-zA-Z0-9_$]+)\s*\([^;{}]*\)(?:\s*throws\s+[^{;]+)?\s*\{/;
  const javaConstructorRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:public|protected|private)\s+([A-Z][a-zA-Z0-9_$]*)\s*\([^;{}]*\)(?:\s*throws\s+[^{;]+)?\s*\{/;
  const sqlRegex = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+([a-zA-Z0-9_]+)/i;
  const methodRegex = /^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)+([a-zA-Z0-9_$]+)\s*\([^;{}]*\)\s*(?::\s*[^;{]+)?(?:\s*throws\s+[^{;]+)?\s*\{/;
  const javaMultilineStartRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[a-zA-Z0-9_<>\[\],.?]+\s+([a-zA-Z0-9_$]+)\s*\([^)]*$/;

  let m = boiRegex.exec(rawLine);
  if (m) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = jsFuncRegex.exec(rawLine))) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = jsArrowRegex.exec(rawLine))) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = pyRegex.exec(rawLine))) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = javaRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = javaConstructorRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = sqlRegex.exec(rawLine))) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = methodRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch|return)\b/.test(trimmed)) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  if ((m = javaMultilineStartRegex.exec(rawLine)) && !/^\s*(?:if|for|while|switch|catch)\b/.test(trimmed)) {
    let hasClosedParen = false;
    let foundHeaderEnd = false;
    for (let lookahead = lineIdx + 1; lookahead < Math.min(lines.length, lineIdx + 35); lookahead++) {
      const l = lines[lookahead].trim();
      if (l.includes(')')) hasClosedParen = true;
      if (hasClosedParen && l.includes('{')) {
        foundHeaderEnd = true;
        break;
      }
      if (l.includes(';')) break;
    }
    if (foundHeaderEnd) return { name: m[1], col: rawLine.indexOf(m[1]) + 1 };
  }
  return null;
}

/**
 * Detects the function corresponding to the current cursor line.
 * Highly optimized (< 0.1ms) by scanning locally around cursor instead of parsing entire file.
 */
export function getCurrentFunctionAtCursor(
  content: string,
  cursorLine: number,
  lang?: string
): {
  fn: FunctionSymbolItem | null;
  isAtDefinition: boolean;
  isInsideBody: boolean;
} {
  if (!content || cursorLine < 1) {
    return { fn: null, isAtDefinition: false, isInsideBody: false };
  }

  const lines = content.split(/\r?\n/);
  if (cursorLine > lines.length) {
    return { fn: null, isAtDefinition: false, isInsideBody: false };
  }

  const normalizedLang = (lang || '').toLowerCase();
  const isPython = normalizedLang.includes('py') || normalizedLang.includes('python');
  const isBoiScript = normalizedLang.includes('boi') || normalizedLang.includes('script');

  const excludedKeywords = new Set(['if', 'while', 'for', 'switch', 'catch', 'function', 'return', 'new', 'throw', 'class', 'interface', 'enum']);

  // 1. Direct match on definition line
  const directCandidate = testLineForFunctionDefinition(lines[cursorLine - 1], lines, cursorLine - 1);
  if (directCandidate && !excludedKeywords.has(directCandidate.name)) {
    const endLine = findFunctionEndLine(lines, cursorLine - 1, isPython, isBoiScript);
    return {
      fn: {
        name: directCandidate.name,
        line: cursorLine,
        column: directCandidate.col > 0 ? directCandidate.col : 1,
        endLine: Math.max(endLine, cursorLine),
        preview: lines[cursorLine - 1].trim()
      },
      isAtDefinition: true,
      isInsideBody: false
    };
  }

  // 2. Scan upwards to find enclosing function definition without full document parsing
  let consecutiveMisses = 0;
  for (let i = cursorLine - 2; i >= 0; i--) {
    const candidate = testLineForFunctionDefinition(lines[i], lines, i);
    if (candidate && !excludedKeywords.has(candidate.name)) {
      const endLine = findFunctionEndLine(lines, i, isPython, isBoiScript);
      if (cursorLine <= endLine) {
        return {
          fn: {
            name: candidate.name,
            line: i + 1,
            column: candidate.col > 0 ? candidate.col : 1,
            endLine: Math.max(endLine, i + 1),
            preview: lines[i].trim()
          },
          isAtDefinition: false,
          isInsideBody: true
        };
      } else {
        // Function ended before cursorLine. In standard code, functions do not deeply overlap.
        consecutiveMisses++;
        if (consecutiveMisses >= 3) {
          break; // Stop scanning further up
        }
      }
    }
  }

  return { fn: null, isAtDefinition: false, isInsideBody: false };
}

export interface FunctionCallSite {
  name: string;
  column: number;     // 1-based column of function call name
  distance: number;   // Absolute distance to cursor column
}

/**
 * Finds all function calls on a single line of text and sorts them
 * by proximity to cursorColumn (closest first).
 */
export function findFunctionCallsOnLine(
  lineText: string,
  cursorColumn: number
): FunctionCallSite[] {
  if (!lineText) return [];

  // Ignore inline comments before matching
  let checkLine = lineText;
  const commentIdx = checkLine.indexOf('//');
  if (commentIdx !== -1) {
    checkLine = checkLine.substring(0, commentIdx);
  }

  const callRegex = /\b([a-zA-Z0-9_$]+)\s*\(/g;
  const keywords = new Set([
    'if', 'while', 'for', 'switch', 'catch', 'return', 'throw', 
    'typeof', 'sizeof', 'instanceof', 'function', 'new', 'synchronized'
  ]);
  const calls: FunctionCallSite[] = [];
  let m: RegExpExecArray | null = null;

  while ((m = callRegex.exec(checkLine)) !== null) {
    const fnName = m[1];
    if (keywords.has(fnName)) continue;
    const col = m.index + 1;
    calls.push({
      name: fnName,
      column: col,
      distance: Math.abs(col - cursorColumn)
    });
  }

  calls.sort((a, b) => a.distance - b.distance);
  return calls;
}

/**
 * Finds the definition of a specific function by name in code content.
 * Fast direct scan without parsing the entire file (< 0.1ms).
 */
export function findFunctionDefinition(
  content: string,
  funcName: string,
  _lang?: string
): FunctionSymbolItem | null {
  if (!content || !funcName) return null;
  const trimmedName = funcName.trim();
  if (!trimmedName) return null;

  const lines = content.split(/\r?\n/);
  const escapedName = escapeRegex(trimmedName);

  const boiDefRegex = new RegExp(`^\\s*function\\s+${escapedName}\\b`, 'i');
  const pyDefRegex = new RegExp(`^\\s*def\\s+${escapedName}\\b`);
  const jsDefRegex = new RegExp(`^\\s*(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s*\\*?\\s+${escapedName}\\b`);
  const jsArrowDefRegex = new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[a-zA-Z0-9_$]+)\\s*=>`);
  const javaDefRegex = new RegExp(`^\\s*(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\\s+)+[a-zA-Z0-9_<>[\\].,?]+\\s+${escapedName}\\s*\\(`);
  const javaConstructorDefRegex = new RegExp(`^\\s*(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:public|protected|private)\\s+${escapedName}\\s*\\(`);
  const genericMethodDefRegex = new RegExp(`^\\s*(?:(?:public|private|protected|static|async|override|readonly)\\s+)*${escapedName}\\s*\\(`);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.includes(trimmedName)) continue; // Micro-optimization: skip line if name not present

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      continue;
    }

    if (
      boiDefRegex.test(rawLine) ||
      jsDefRegex.test(rawLine) ||
      jsArrowDefRegex.test(rawLine) ||
      pyDefRegex.test(rawLine) ||
      javaDefRegex.test(rawLine) ||
      javaConstructorDefRegex.test(rawLine) ||
      genericMethodDefRegex.test(rawLine)
    ) {
      const col = rawLine.indexOf(trimmedName) + 1;
      return {
        name: trimmedName,
        line: i + 1,
        column: col > 0 ? col : 1,
        endLine: i + 1,
        preview: trimmed
      };
    }
  }

  return null;
}

export type UsagesModalAction = 'next' | 'prev' | 'confirm' | 'close' | 'none';

export interface UsagesModalActionResult {
  action: UsagesModalAction;
  preventDefault: boolean;
  stopPropagation: boolean;
}

/**
 * Normalizes keyboard events received by FunctionUsagesModal and maps them to clean semantic actions.
 * 
 * Supported keys:
 * - ArrowDown / Down / Ctrl+ArrowDown / Ctrl+Down -> 'next' (cycle to next usage)
 * - ArrowUp / Up / Ctrl+ArrowUp / Ctrl+Up -> 'prev' (cycle to previous usage)
 * - Enter / NumpadEnter / Ctrl+Right / Space -> 'confirm' (choose selected usage)
 * - Escape / Ctrl+Left -> 'close' (cancel and restore cursor position)
 * - Any other key (letter, ctrl-combo) -> 'none' with stopPropagation to isolate modal from editor
 */
export function getFunctionUsagesModalAction(e: {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): UsagesModalActionResult {
  const k = (e.key || '').toLowerCase();
  const code = e.code || '';
  const isUp = k === 'arrowup' || k === 'up' || code === 'ArrowUp';
  const isDown = k === 'arrowdown' || k === 'down' || code === 'ArrowDown';
  const isLeft = k === 'arrowleft' || k === 'left' || code === 'ArrowLeft';
  const isRight = k === 'arrowright' || k === 'right' || code === 'ArrowRight';
  const isEnter = k === 'enter' || code === 'Enter' || code === 'NumpadEnter';
  const isEscape = k === 'escape' || code === 'Escape';

  // Navigation: Down / Next
  if (isDown || (e.ctrlKey && isDown)) {
    return { action: 'next', preventDefault: true, stopPropagation: true };
  }

  // Navigation: Up / Prev
  if (isUp || (e.ctrlKey && isUp)) {
    return { action: 'prev', preventDefault: true, stopPropagation: true };
  }

  // Confirm: Enter, NumpadEnter, Ctrl+Right, or bare Space
  if (isEnter || (e.ctrlKey && isRight) || (k === ' ' && !e.ctrlKey && !e.altKey)) {
    return { action: 'confirm', preventDefault: true, stopPropagation: true };
  }

  // Close / Cancel: Escape or Ctrl+Left
  if (isEscape || (e.ctrlKey && isLeft)) {
    return { action: 'close', preventDefault: true, stopPropagation: true };
  }

  // Prevent background editor from typing or triggering hotkeys while modal is open
  const shouldBlock = Boolean(e.ctrlKey || e.altKey || (k && k.length === 1));
  return { action: 'none', preventDefault: false, stopPropagation: shouldBlock };
}

/**
 * Calculates the next or previous index in a circular list of usages.
 */
export function cycleUsageIndex(currentIndex: number, total: number, direction: 'next' | 'prev'): number {
  if (total <= 0) return 0;
  if (direction === 'next') {
    return (currentIndex + 1) % total;
  }
  return (currentIndex - 1 + total) % total;
}

export type MouseNavigationAction = 'back' | 'forward' | 'none';

/**
 * Maps standard browser mouse button numbers to cursor history navigation actions.
 * button 3: Fourth button (Browser Back, Mouse 4 / 5)
 * button 4: Fifth button (Browser Forward, Mouse 5 / 6)
 */
export function getMouseNavigationAction(button: number, enabled: boolean = true): MouseNavigationAction {
  if (!enabled) return 'none';
  if (button === 3) return 'back';
  if (button === 4) return 'forward';
  return 'none';
}

/**
 * Calculates new cursor history index based on navigation action.
 * Returns -1 if no movement is possible.
 */
export function navigateCursorHistoryIndex(currentIndex: number, totalLength: number, action: 'back' | 'forward'): number {
  if (action === 'back') {
    if (currentIndex > 0) return currentIndex - 1;
    return -1;
  }
  if (action === 'forward') {
    if (currentIndex >= 0 && currentIndex < totalLength - 1) return currentIndex + 1;
    return -1;
  }
  return -1;
}


