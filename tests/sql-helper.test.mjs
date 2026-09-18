import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test implementation mirroring useSQLHelper logic
function highlightSql(sql) {
  if (!sql || sql.startsWith('--')) return sql;
  const escapeHtml = (u) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));

  // 1. Protect strings
  const strings = [];
  let h = sql.replace(/'([^']*)'/g, (_match, strContent) => {
    strings.push(strContent);
    return `___SQL_STR_${strings.length - 1}___`;
  });

  h = escapeHtml(h);

  // 2. Prominently highlight table names in FROM, JOIN, UPDATE, INTO, TABLE
  h = h.replace(/\b(FROM|JOIN|UPDATE|INTO|TABLE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi, (_m, clause, table) => {
    return `${clause} <span class="sql-tbl">${table}</span>`;
  });

  // Also match comma-separated additional tables in FROM clause (e.g. FROM table1, table2)
  h = h.replace(/(<span class="sql-tbl">[a-zA-Z0-9_.]+<\/span>)(\s*,\s*)([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi, (_m, pre, comma, nextTable) => {
    return `${pre}${comma}<span class="sql-tbl">${nextTable}</span>`;
  });

  // 3. Highlight SQL Keywords
  const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AND|OR|IN|ORDER BY|GROUP BY|LIMIT|OFFSET|AS|TRIM|INSERT|INTO|UPDATE|DELETE|SET|VALUES|COUNT|AVG|SUM|MIN|MAX|HAVING|DISTINCT|UNION|ALL|EXISTS|IS|NULL|NOT|BETWEEN|CASE|WHEN|THEN|ELSE|END|ASC|DESC|LIKE|ILIKE|CREATE|DROP|ALTER|TABLE)\b/gi;
  h = h.replace(keywords, '<span class="sql-kwd">$1</span>');

  // 4. Restore strings with syntax class
  h = h.replace(/___SQL_STR_(\d+)___/g, (_m, idx) => {
    const original = strings[parseInt(idx, 10)] || '';
    return `<span class="sql-str">'${escapeHtml(original)}'</span>`;
  });

  return h;
}

function detectSqlIds(logText) {
  if (!logText) return [];
  const ids = new Set();
  const regex = /(?:uniq_id\s*=\s*\(([^)]+)\)|id\s*=\s*([a-zA-Z0-9_.-]+))/gi;
  let match;
  while ((match = regex.exec(logText)) !== null) {
    const id = match[1] || match[2];
    if (id && id.trim()) {
      ids.add(id.trim());
    }
  }
  return Array.from(ids);
}

describe('SQL Helper - Table Highlighting & ID Extraction', () => {
  it('highlights table names in SELECT ... FROM and JOIN clauses', () => {
    const sql = 'SELECT u.id, o.amount FROM users u INNER JOIN orders o ON u.id = o.user_id';
    const highlighted = highlightSql(sql);

    assert.ok(highlighted.includes('<span class="sql-tbl">users</span>'), 'users table should be wrapped in sql-tbl');
    assert.ok(highlighted.includes('<span class="sql-tbl">orders</span>'), 'orders table should be wrapped in sql-tbl');
    assert.ok(highlighted.includes('<span class="sql-kwd">SELECT</span>'), 'SELECT keyword should be wrapped in sql-kwd');
    assert.ok(highlighted.includes('<span class="sql-kwd">FROM</span>'), 'FROM keyword should be wrapped in sql-kwd');
  });

  it('highlights schema-qualified table names and UPDATE / INSERT INTO clauses', () => {
    const updateSql = "UPDATE public.accounts SET balance = 1000 WHERE id = 'A1'";
    const updateH = highlightSql(updateSql);
    assert.ok(updateH.includes('<span class="sql-tbl">public.accounts</span>'), 'public.accounts table should be wrapped in sql-tbl');

    const insertSql = "INSERT INTO order_items (item_id, qty) VALUES (1, 5)";
    const insertH = highlightSql(insertSql);
    assert.ok(insertH.includes('<span class="sql-tbl">order_items</span>'), 'order_items table should be wrapped in sql-tbl');
  });

  it('detects both uniq_id=(...) and id=... patterns in log content', () => {
    const log = `
      [INFO] uniq_id=(jp.co.vinx.sample.SelectUsers) sql=SELECT * FROM users, params=[]
      [DEBUG] id=order_update_query sql=UPDATE orders SET status='DONE', params=[]
      [INFO] id=jp.co.vinx.billing.InvoiceReport sql=SELECT * FROM invoices, params=[]
    `;
    const ids = detectSqlIds(log);
    assert.deepEqual(ids, [
      'jp.co.vinx.sample.SelectUsers',
      'order_update_query',
      'jp.co.vinx.billing.InvoiceReport'
    ]);
  });

  it('does not incorrectly highlight keywords inside quoted string literals', () => {
    const sql = "SELECT * FROM products WHERE description = 'FROM WHERE JOIN UPDATE'";
    const h = highlightSql(sql);
    assert.ok(h.includes("<span class=\"sql-str\">&#39;FROM WHERE JOIN UPDATE&#39;</span>") || h.includes("<span class=\"sql-str\">'FROM WHERE JOIN UPDATE'</span>"), 'Strings should remain intact');
    assert.ok(h.includes('<span class="sql-tbl">products</span>'), 'products table should be highlighted');
  });
});
