import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const sampleText = `2026-09-18 11:12:41,INFO,commons.dao.PreparedStatementEx,<init>              ,CreatePreparedStatement id=40f57e17   sql=INSERT INTO DT_TABLE_LOG   ( FQCN, ERROR_LEVEL, LOG_MESSAGE, UPDATE_TS , SEQ_NUM ) VALUES (   ?,   ?,   ?,   SYSDATETIME() ,   CONCAT (     CONVERT(VARCHAR, SYSDATETIME(),  112) ,     RIGHT('000000000000' + NEXT VALUE FOR H2OACT004.dbo.SEQ_DT_TABLE_LOG_NB , 12 )   ) )`;

function getDisplayHtml(logContent, existingIds = new Set()) {
  const escapeHtml = (u) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
  let decoded = logContent.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
  let html = escapeHtml(decoded);

  html = html.replace(/(?:(uniq_id\s*=\s*\()([^)]+)(\))|(id\s*=\s*)([a-zA-Z0-9_.-]+))/gi, (_match, uniqPre, uniqId, uniqPost, idPre, idVal) => {
    const actualId = uniqId || idVal;
    const extra = existingIds.has(actualId.toLowerCase()) ? ' existing-id' : '';
    if (uniqId) {
      return `${uniqPre}<span class="clickable-id${extra}" data-id="${uniqId}">${uniqId}</span>${uniqPost}`;
    }
    return `${idPre}<span class="clickable-id${extra}" data-id="${idVal}">${idVal}</span>`;
  });

  return html;
}

function processSqlFromLog(logContent, searchId) {
  const idToFind = searchId.trim().toLowerCase();
  const lines = logContent.split(/\r?\n/);
  let foundSql = '', foundParams = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIdMatch = line.toLowerCase().includes(`id=${idToFind}`) || line.toLowerCase().includes(`id=(${idToFind})`);
    if (isIdMatch) {
      const sqlMatch = line.match(/sql\s*=\s*(.+?)(?=\s*,\s*\w+\s*=|$)/i);
      if (sqlMatch) foundSql = sqlMatch[1];
      const paramsMatch = line.match(/params\s*=\s*\[(.+?)\](?=\s*,\s*\w+\s*=|$)/i);
      if (paramsMatch) foundParams = paramsMatch[1];
    }
  }
  return foundSql;
}

function highlightSql(sql) {
  if (!sql || sql.startsWith('--')) return sql;
  const escapeHtml = (u) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));

  const strings = [];
  let h = sql.replace(/'([^']*)'/g, (_match, strContent) => {
    strings.push(strContent);
    return `___SQL_STR_${strings.length - 1}___`;
  });

  h = escapeHtml(h);

  h = h.replace(/\b(FROM|JOIN|UPDATE|INTO|TABLE)\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)/gi, (_m, clause, table) => {
    return `${clause} <span class="sql-tbl">${table}</span>`;
  });

  const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|AND|OR|IN|ORDER BY|GROUP BY|LIMIT|OFFSET|AS|TRIM|INSERT|INTO|UPDATE|DELETE|SET|VALUES|COUNT|AVG|SUM|MIN|MAX|HAVING|DISTINCT|UNION|ALL|EXISTS|IS|NULL|NOT|BETWEEN|CASE|WHEN|THEN|ELSE|END|ASC|DESC|LIKE|ILIKE|CREATE|DROP|ALTER|TABLE)\b/gi;
  h = h.replace(keywords, '<span class="sql-kwd">$1</span>');

  h = h.replace(/___SQL_STR_(\d+)___/g, (_m, idx) => {
    const original = strings[parseInt(idx, 10)] || '';
    return `<span class="sql-str">'${escapeHtml(original)}'</span>`;
  });

  return h;
}

describe('User sample test', () => {
  it('converts id=40f57e17 to clickable-id', () => {
    const html = getDisplayHtml(sampleText);
    assert.ok(html.includes('data-id="40f57e17"'));
    assert.ok(html.includes('class="clickable-id"'));
  });

  it('highlights existing-id when extracted', () => {
    const html = getDisplayHtml(sampleText, new Set(['40f57e17']));
    assert.ok(html.includes('class="clickable-id existing-id"'));
  });

  it('extracts SQL and highlights table name DT_TABLE_LOG in red class sql-tbl', () => {
    const sql = processSqlFromLog(sampleText, '40f57e17');
    assert.ok(sql.includes('INSERT INTO DT_TABLE_LOG'));
    const highlighted = highlightSql(sql);
    console.log('HIGHLIGHTED SQL:', highlighted);
    assert.ok(highlighted.includes('<span class="sql-tbl">DT_TABLE_LOG</span>'));
  });
});

