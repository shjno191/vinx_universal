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
 * Calculates the ending line of a function starting at startLineIndex (0-based).
 */
function findFunctionEndLine(
  lines: string[],
  startLineIndex: number,
  isPython: boolean,
  isBoiScript: boolean
): number {
  const totalLines = lines.length;

  // 1. Python Indentation-based scope
  if (isPython) {
    const defLine = lines[startLineIndex];
    const baseIndent = defLine.search(/\S/);
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

  // 2. BOI script `function ... endfunction`
  if (isBoiScript) {
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

  // 3. Brace-based scoping (BOI script with braces, JS, TS, Java, C, etc.)
  let openBraces = 0;
  let hasOpened = false;

  for (let i = startLineIndex; i < totalLines; i++) {
    const line = lines[i];
    if (!line.includes('{') && !line.includes('}')) {
      continue;
    }
    // Strip comments and string literals to avoid counting fake braces
    const sanitized = line
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
      .replace(/\/\/.*$/, '');

    for (let charIdx = 0; charIdx < sanitized.length; charIdx++) {
      const ch = sanitized[charIdx];
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
  // Java / C# method with modifiers, return type, throws clause
  const javaRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[\w<>\[\],\s?]+\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;
  // Java multiline signature start (parameter list spans across lines)
  const javaMultilineStartRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|protected|private|static|final|native|synchronized|abstract|default)\s+)+[\w<>\[\],\s?]+\s+([a-zA-Z0-9_$]+)\s*\([^)]*$/;
  // Java constructor (no return type)
  const javaConstructorRegex = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:public|protected|private)\s+([A-Z][a-zA-Z0-9_$]*)\s*\([^)]*\)(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;
  const sqlRegex = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+([a-zA-Z0-9_]+)/i;
  const methodRegex = /^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^;{]+)?(?:\s*throws\s+[\w\s,.<>]+)?\s*\{/;

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
 * Detects the function corresponding to the current cursor line.
 * Returns:
 * - fn: The innermost function enclosing the cursor or on the definition line.
 * - isAtDefinition: True if cursor is on the function definition line.
 * - isInsideBody: True if cursor is strictly inside the function body (line > fn.line && line <= fn.endLine).
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
  const allFns = extractFunctionsFromContent(content, lang);
  if (allFns.length === 0) {
    return { fn: null, isAtDefinition: false, isInsideBody: false };
  }

  // 1. Direct match on definition line
  const directMatch = allFns.find(f => f.line === cursorLine);
  if (directMatch) {
    return { fn: directMatch, isAtDefinition: true, isInsideBody: false };
  }

  // 2. Check if cursor is inside any function's body [line + 1, endLine]
  // Pick the innermost enclosing function (smallest range)
  const enclosingFns = allFns.filter(f => cursorLine > f.line && cursorLine <= f.endLine);
  if (enclosingFns.length > 0) {
    enclosingFns.sort((a, b) => (a.endLine - a.line) - (b.endLine - b.line));
    const targetFn = enclosingFns[0];
    return { fn: targetFn, isAtDefinition: false, isInsideBody: true };
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
 */
export function findFunctionDefinition(
  content: string,
  funcName: string,
  lang?: string
): FunctionSymbolItem | null {
  if (!content || !funcName) return null;
  const fns = extractFunctionsFromContent(content, lang);
  return fns.find(f => f.name === funcName) || null;
}
