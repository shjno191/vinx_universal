import { ref, shallowRef, computed, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { sanitize } from '../utils/security';

export interface Extraction {
  searchId: string;
  resultSql: string;
}

export function useSQLHelper() {
  const logPath = ref('');
  const logContent = shallowRef('');
  const isInputMode = ref(false);
  const extractions = ref<Extraction[]>([{ searchId: '', resultSql: '' }]);
  const displayHtml = shallowRef('');
  const isLoading = ref(false);
  const isLogTooLarge = computed(() => logContent.value.length > 200000);

  const clearLog = () => {
    logContent.value = '';
    logPath.value = '';
    displayHtml.value = '';
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        logContent.value = text;
        isInputMode.value = false;
        updateDisplayHtml();
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const removeExtraction = (index: number) => {
    extractions.value.splice(index, 1);
    if (extractions.value.length === 0) {
      extractions.value.push({ searchId: '', resultSql: '' });
    }
  };

  const clearAllExtractions = () => {
    extractions.value = [{ searchId: '', resultSql: '' }];
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
    let h = escapeHtml(sql);
    const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|IN|ORDER BY|GROUP BY|LIMIT|OFFSET|AS|TRIM|INSERT INTO|UPDATE|DELETE|SET|VALUES|COUNT|AVG|SUM|MIN|MAX|HAVING|DISTINCT|UNION|ALL|EXISTS|IS|NULL|NOT|BETWEEN|CASE|WHEN|THEN|ELSE|END)\b/gi;
    h = h.replace(keywords, '<span class="sql-kwd">$1</span>');
    h = h.replace(/\b(FROM|JOIN)\b\s+([a-zA-Z0-9_]+)/gi, '$1 <span class="sql-tbl">$2</span>');
    h = h.replace(/'([^']*)'/g, '<span class="sql-str">\'$1\'</span>');
    return sanitize(h);
  };

  const loadFromFile = async () => {
    const trimmedPath = logPath.value.trim();
    if (!trimmedPath) return;
    try {
      isLoading.value = true;
      const content = await invoke<string>('read_file_content', { path: trimmedPath });
      logContent.value = content;
      isInputMode.value = false;
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
    let sql = extractions.value[index].resultSql;
    if (!sql || sql.startsWith('--')) return;

    sql = sql.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/\s+/g, ' ').trim();
    const tokens = sql.split(' ');
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'AND', 'OR', 'ORDER', 'GROUP', 'SET', 'VALUES', 'LIMIT', 'UPDATE', 'INSERT', 'DELETE', 'UNION', 'HAVING'];
    
    let indentLevel = 0;
    let result = '';
    const indentStep = '    ';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const upperToken = token.toUpperCase();
      
      if (keywords.includes(upperToken)) {
        let combinedToken = token;
        if (['ORDER', 'GROUP', 'DELETE'].includes(upperToken)) {
          const next = tokens[i+1]?.toUpperCase();
          if ((upperToken === 'DELETE' && next === 'FROM') || (upperToken !== 'DELETE' && next === 'BY')) {
            combinedToken += ' ' + tokens[++i];
          }
        } else if (upperToken === 'INSERT' && tokens[i+1]?.toUpperCase() === 'INTO') {
          combinedToken += ' ' + tokens[++i];
        }
        
        if (result.length > 0) {
          result = result.trimEnd() + '\n' + indentStep.repeat(indentLevel);
        }
        result += combinedToken + ' ';
      } else if (token === '(') {
        result = result.trimEnd() + ' (\n' + indentStep.repeat(++indentLevel);
      } else if (token === ')') {
        indentLevel = Math.max(0, indentLevel - 1);
        result = result.trimEnd() + '\n' + indentStep.repeat(indentLevel) + ') ';
      } else if (token === ',') {
        result = result.trimEnd() + ', ';
      } else {
        result += token + ' ';
      }
    }
    extractions.value[index].resultSql = result.trim().replace(/ +\n/g, '\n');
  };

  const updateDisplayHtml = () => {
    const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
    let decoded = logContent.value.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
    let html = escapeHtml(decoded);
    
    if (logContent.value.length > 200000) {
      displayHtml.value = html;
      return;
    }

    html = html.replace(/(?:(uniq_id\s*=\s*\()([^)]+)(\))|(id\s*=\s*)([a-zA-Z0-9_-]+))/gi, (_match, uniqPre, uniqId, uniqPost, idPre, idVal) => {
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
    isInputMode,
    extractions,
    displayHtml,
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
    updateDisplayHtml
  };
}
