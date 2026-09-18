import { ref, shallowRef, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { sanitize, cleanAndFormatSql } from '@vinx/sdk';

export interface Extraction {
  searchId: string;
  resultSql: string;
}

export function useSQLHelper() {
  const logPath = ref('');
  const logContent = shallowRef('');
  const extractions = ref<Extraction[]>([]);
  const displayHtml = shallowRef('');
  const isLoading = ref(false);
  const isLogTooLarge = computed(() => logContent.value.length > 200000);

  const clearLog = () => {
    logContent.value = '';
    logPath.value = '';
    displayHtml.value = '';
  };

  const detectedIds = computed(() => {
    const text = logContent.value;
    if (!text) return [];
    const ids = new Set<string>();
    const regex = /(?:uniq_id\s*=\s*\(([^)]+)\)|id\s*=\s*([a-zA-Z0-9_.-]+))/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const id = match[1] || match[2];
      if (id && id.trim()) {
        ids.add(id.trim());
      }
    }
    return Array.from(ids);
  });

  const isIdExtracted = (id: string) => {
    const target = id.trim().toLowerCase();
    return extractions.value.some(ex => ex.searchId.trim().toLowerCase() === target);
  };

  const extractById = (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    const existingIdx = extractions.value.findIndex(
      ex => ex.searchId.trim().toLowerCase() === cleanId.toLowerCase()
    );

    if (existingIdx !== -1) {
      extractions.value.splice(existingIdx, 1);
      updateDisplayHtml();
      return;
    }

    let emptyIdx = extractions.value.findIndex(ex => !ex.searchId.trim());
    if (emptyIdx === -1) {
      extractions.value.push({ searchId: cleanId, resultSql: '' });
      emptyIdx = extractions.value.length - 1;
    } else {
      extractions.value[emptyIdx].searchId = cleanId;
    }
    processSql(emptyIdx);
    updateDisplayHtml();
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        logContent.value = text;
        updateDisplayHtml();
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const removeExtraction = (index: number) => {
    extractions.value.splice(index, 1);
    updateDisplayHtml();
  };

  const clearAllExtractions = () => {
    extractions.value = [];
    updateDisplayHtml();
  };

  const existingIds = computed(() => {
    const ids = new Set<string>();
    extractions.value.forEach(ex => {

      if (ex.searchId.trim()) ids.add(ex.searchId.trim().toLowerCase());
    });
    return ids;
  });

  const highlightSql = (sql: string) => {
    if (!sql || sql.startsWith('--')) return sql;
    const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));

    // 1. Protect strings
    const strings: string[] = [];
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

    return sanitize(h);
  };

  const loadFromFile = async () => {
    const trimmedPath = logPath.value.trim();
    if (!trimmedPath) return;
    try {
      isLoading.value = true;
      const content = await invoke<string>('read_file_content', { path: trimmedPath });
      logContent.value = content;
      updateDisplayHtml();
    } catch (e) {
      alert(`Error loading file: ${e}`);
    } finally {
      isLoading.value = false;
    }
  };

  const chooseFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Log Files', extensions: ['log', 'txt', 'sql'] }]
      });
      if (selected && typeof selected === 'string') {
        logPath.value = selected;
        await loadFromFile();
      }
    } catch (e) {
      console.error('Failed to open file dialog', e);
    }
  };

  const processSql = (index: number) => {
    if (!extractions.value[index]) return;
    const idToFind = extractions.value[index].searchId.trim().toLowerCase();
    if (!idToFind) return;
    const lines = logContent.value.split(/\r?\n/);
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

    if (foundSql) {
      let result = foundSql;
      if (foundParams) {
        const paramParts = foundParams.match(/\[?([^\]\[]+)\]?/g) || foundParams.split(',');
        const formattedParams = paramParts.map(p => {
          let clean = p.replace(/[\[\]]/g, '').trim();
          const parts = clean.split(':');
          if (parts.length >= 3) return parts.slice(2).join(':'); 
          return clean;
        });
        formattedParams.forEach(p => {
          result = result.replace('?', `'${p}'`);
        });
      }
      let decoded = result.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
      extractions.value[index].resultSql = decoded.replace(/\s+/g, ' ').trim();
    } else {
      extractions.value[index].resultSql = '-- No SQL found for this ID';
    }
  };

  const formatSql = (index: number) => {
    if (!extractions.value[index]) return;
    const sql = extractions.value[index].resultSql;
    if (!sql || sql.startsWith('--')) return;
    extractions.value[index].resultSql = cleanAndFormatSql(sql);
  };

  const updateDisplayHtml = () => {
    const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
    let decoded = logContent.value.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
    let html = escapeHtml(decoded);
    
    if (logContent.value.length > 200000) {
      displayHtml.value = html;
      return;
    }

    html = html.replace(/(?:(uniq_id\s*=\s*\()([^)]+)(\))|(id\s*=\s*)([a-zA-Z0-9_.-]+))/gi, (_match, uniqPre, uniqId, uniqPost, idPre, idVal) => {
      const actualId = uniqId || idVal;
      const extra = existingIds.value.has(actualId.toLowerCase()) ? ' existing-id' : '';
      if (uniqId) {
        return `${uniqPre}<span class="clickable-id${extra}" data-id="${uniqId}">${uniqId}</span>${uniqPost}`;
      }
      return `${idPre}<span class="clickable-id${extra}" data-id="${idVal}">${idVal}</span>`;
    });

    displayHtml.value = sanitize(html);
  };

  return {
    logPath,
    logContent,
    extractions,
    displayHtml,
    detectedIds,
    isLoading,
    isLogTooLarge,
    clearLog,
    pasteFromClipboard,
    removeExtraction,
    clearAllExtractions,
    highlightSql,
    loadFromFile,
    chooseFile,
    processSql,
    formatSql,
    updateDisplayHtml,
    extractById,
    isIdExtracted
  };
}

