import { cleanAndFormatSql } from '@vinx/sdk';

export interface SqlEditorFormatInput {
  text: string;
  rawBeforeFormat: string | null;
  isFormatted: boolean;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface SqlEditorFormatResult {
  text: string;
  rawBeforeFormat: string | null;
  isFormatted: boolean;
}

const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return m;
    }
  });

/**
 * Formats SQL in the SQL Editor sub-tab, supporting selection formatting
 * and toggling back to raw SQL when clicked a second time without modifications.
 */
export function formatSqlInEditor(input: SqlEditorFormatInput): SqlEditorFormatResult {
  const { text, rawBeforeFormat, isFormatted, selectionStart, selectionEnd } = input;

  if (!text || !text.trim()) {
    return { text, rawBeforeFormat: null, isFormatted: false };
  }

  // Format only selected range when a non-empty selection is active
  if (
    typeof selectionStart === 'number' &&
    typeof selectionEnd === 'number' &&
    selectionEnd > selectionStart
  ) {
    const selected = text.slice(selectionStart, selectionEnd);
    if (!selected.trim()) {
      return { text, rawBeforeFormat, isFormatted };
    }
    const formattedSelection = cleanAndFormatSql(selected);
    const nextText =
      text.slice(0, selectionStart) + formattedSelection + text.slice(selectionEnd);
    return {
      text: nextText,
      rawBeforeFormat,
      isFormatted: true,
    };
  }

  // Toggle back to initial raw SQL if already formatted and unmodified
  if (isFormatted && rawBeforeFormat !== null) {
    const expectedFormatted = cleanAndFormatSql(rawBeforeFormat);
    if (text === expectedFormatted) {
      return {
        text: rawBeforeFormat,
        rawBeforeFormat: null,
        isFormatted: false,
      };
    }
  }

  const formatted = cleanAndFormatSql(text);
  return {
    text: formatted,
    rawBeforeFormat: text,
    isFormatted: true,
  };
}

/**
 * Highlights SQL code for the native SQL Editor overlay while strictly preserving
 * 1:1 character positions and line breaks so the textarea caret aligns perfectly.
 */
export function highlightSqlForEditor(sql: string): string {
  if (!sql) return '';
  if (sql.length > 100000) {
    return escapeHtml(sql);
  }

  const tokens: { type: 'str' | 'cmt'; value: string }[] = [];

  // 1. Protect single-quoted strings and single-line comments in a single pass
  let protectedSql = sql.replace(/'[^']*'|(--[^\r\n]*)/g, (match, commentMatch) => {
    const idx = tokens.length;
    tokens.push({
      type: commentMatch !== undefined ? 'cmt' : 'str',
      value: match,
    });
    return `___SQLED_TOK_${idx}___`;
  });

  protectedSql = escapeHtml(protectedSql);

  // 2. Highlight table names after FROM, JOIN, UPDATE, INTO, TABLE
  protectedSql = protectedSql.replace(
    /\b(FROM|JOIN|UPDATE|INTO|TABLE)(\s+)([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi,
    (_m, clause, space, table) => `${clause}${space}<span class="sql-ed-tbl">${table}</span>`
  );

  // Also highlight comma-separated tables in FROM clause
  protectedSql = protectedSql.replace(
    /(<span class="sql-ed-tbl">[a-zA-Z0-9_.]+<\/span>)(\s*,\s*)([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi,
    (_m, prev, comma, nextTable) =>
      `${prev}${comma}<span class="sql-ed-tbl">${nextTable}</span>`
  );

  // 3. Highlight SQL keywords
  const keywordRegex =
    /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AND|OR|IN|ORDER BY|GROUP BY|LIMIT|OFFSET|AS|TRIM|INSERT|INTO|UPDATE|DELETE|SET|VALUES|COUNT|AVG|SUM|MIN|MAX|HAVING|DISTINCT|UNION|ALL|EXISTS|IS|NULL|NOT|BETWEEN|CASE|WHEN|THEN|ELSE|END|ASC|DESC|LIKE|ILIKE|CREATE|DROP|ALTER|TABLE)\b/gi;
  protectedSql = protectedSql.replace(keywordRegex, '<span class="sql-ed-kwd">$1</span>');

  // 4. Restore strings and comments
  protectedSql = protectedSql.replace(/___SQLED_TOK_(\d+)___/g, (_m, idxStr) => {
    const tok = tokens[parseInt(idxStr, 10)];
    if (!tok) return '';
    const cls = tok.type === 'cmt' ? 'sql-ed-cmt' : 'sql-ed-str';
    return `<span class="${cls}">${escapeHtml(tok.value)}</span>`;
  });

  return protectedSql;
}

/**
 * Counts the number of lines in the SQL editor content (minimum 1).
 */
export function computeLineCount(text: string): number {
  if (!text) return 1;
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

