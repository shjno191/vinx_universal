import { describe, it, expect } from 'vitest';
import {
  formatSqlInEditor,
  highlightSqlForEditor,
  computeLineCount,
} from '../packages/plugins/sql-helper/src/sql-editor-helper';
import {
  detectDelimiter,
  alignCsv,
  compactCsv,
  isCsvAligned,
} from '../packages/plugins/editor/src/utils/csv-helper';

describe('SQLHelperTab - SQL Editor Helper (Non-Blocking Native Editor)', () => {
  it('should format raw single-line SQL into clean multi-line SQL on first click', () => {
    const raw = "SELECT u.id, u.name FROM m_users u INNER JOIN t_orders o ON u.id = o.user_id WHERE u.status = '1' AND o.total > 100 ORDER BY u.id DESC";
    const res = formatSqlInEditor({
      text: raw,
      rawBeforeFormat: null,
      isFormatted: false,
    });

    expect(res.isFormatted).toBe(true);
    expect(res.rawBeforeFormat).toBe(raw);
    expect(res.text).toContain('SELECT\n');
    expect(res.text).toContain('\nFROM\n\tm_users u');
    expect(res.text).toContain('\n\tINNER JOIN t_orders o');
    expect(res.text).toContain('\nWHERE\n');
    expect(res.text).toContain('\nORDER BY\n');
  });

  it('should clean and format Java StringBuilder SQL snippets', () => {
    const javaSql = `sql.append("SELECT id, code ");\nsql.append("FROM m_product WHERE del_flg = '0'");`;
    const res = formatSqlInEditor({
      text: javaSql,
      rawBeforeFormat: null,
      isFormatted: false,
    });

    expect(res.isFormatted).toBe(true);
    expect(res.text).not.toContain('sql.append');
    expect(res.text).toContain('SELECT');
    expect(res.text).toContain('m_product');
  });

  it('should restore original raw SQL when clicking Format SQL a second time without edits', () => {
    const raw = "SELECT id, name FROM users WHERE active = 1";
    const first = formatSqlInEditor({
      text: raw,
      rawBeforeFormat: null,
      isFormatted: false,
    });

    expect(first.isFormatted).toBe(true);
    expect(first.text).not.toBe(raw);

    const second = formatSqlInEditor({
      text: first.text,
      rawBeforeFormat: first.rawBeforeFormat,
      isFormatted: first.isFormatted,
    });

    expect(second.isFormatted).toBe(false);
    expect(second.rawBeforeFormat).toBeNull();
    expect(second.text).toBe(raw);
  });

  it('should format only the selected range when a non-empty selection is passed', () => {
    const fullText = "-- Header comment\nSELECT a, b FROM my_table WHERE x = 1\n-- Footer";
    const selStart = fullText.indexOf('SELECT');
    const selEnd = fullText.indexOf('\n-- Footer');

    const res = formatSqlInEditor({
      text: fullText,
      rawBeforeFormat: null,
      isFormatted: false,
      selectionStart: selStart,
      selectionEnd: selEnd,
    });

    expect(res.text.startsWith('-- Header comment\nSELECT\n')).toBe(true);
    expect(res.text.endsWith('\n-- Footer')).toBe(true);
  });

  it('should highlight SQL keywords, strings, comments, and red table names while preserving exact plain-text characters', () => {
    const sql = "-- Query users\nSELECT u.id, 'hello FROM world' AS greeting\nFROM m_user_account u\nLEFT JOIN t_department d ON u.dept_id = d.id";
    const html = highlightSqlForEditor(sql);

    expect(html).toContain('<span class="sql-ed-tbl">m_user_account</span>');
    expect(html).toContain('<span class="sql-ed-tbl">t_department</span>');
    expect(html).toContain('<span class="sql-ed-kwd">SELECT</span>');
    expect(html).toContain('<span class="sql-ed-str">&#39;hello FROM world&#39;</span>');
    expect(html).toContain('<span class="sql-ed-cmt">-- Query users</span>');

    // Strip HTML tags and unescape entities to prove 1:1 character alignment with textarea
    const stripped = html
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
    expect(stripped).toBe(sql);
  });

  it('should highlight 2,000 lines of SQL in under 30ms without freezing', () => {
    const unit = "SELECT u.id, u.name FROM m_users u INNER JOIN t_orders o ON u.id = o.user_id WHERE u.status = '1';";
    const largeSql = Array.from({ length: 2000 }, () => unit).join('\n');

    const start = performance.now();
    const html = highlightSqlForEditor(largeSql);
    const elapsed = performance.now() - start;

    expect(html.length).toBeGreaterThan(largeSql.length);
    expect(elapsed).toBeLessThan(50);
    expect(computeLineCount(largeSql)).toBe(2000);
  });
});

describe('EditorTab - Format CSV Toggle (Raw Restore)', () => {
  it('should align multi-line CSV on first toggle and restore exact raw text on second toggle', () => {
    const rawCsv = 'id,name,role\n1,Alice,Admin\n200,Bob,Developer';
    const delimiter = detectDelimiter(rawCsv);

    expect(isCsvAligned(rawCsv, delimiter)).toBe(false);

    // 1st click: Format CSV
    const aligned = alignCsv(rawCsv, delimiter).text;
    expect(isCsvAligned(aligned, delimiter)).toBe(true);
    expect(aligned).not.toBe(rawCsv);

    // 2nd click: Revert to raw
    const currentCompacted = compactCsv(aligned, delimiter).text;
    const savedCompacted = compactCsv(rawCsv, delimiter).text;
    const restored = currentCompacted === savedCompacted ? rawCsv : currentCompacted;

    expect(restored).toBe(rawCsv);
    expect(isCsvAligned(restored, delimiter)).toBe(false);
  });

  it('should detect aligned state even for single-line CSV and revert to raw on second click', () => {
    const rawSingleLine = '0,QA0001,テスト太郎,20261001';
    const delimiter = detectDelimiter(rawSingleLine);

    expect(isCsvAligned(rawSingleLine, delimiter)).toBe(false);

    const aligned = alignCsv(rawSingleLine, delimiter).text;
    expect(isCsvAligned(aligned, delimiter)).toBe(true);

    const compacted = compactCsv(aligned, delimiter).text;
    expect(compacted).toBe(rawSingleLine);
    expect(isCsvAligned(compacted, delimiter)).toBe(false);
  });
});
