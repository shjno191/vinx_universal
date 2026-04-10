<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const logPath = ref('');
const logContent = ref('');
const logDisplayRef = ref<HTMLElement | null>(null);
const isInputMode = ref(false);

const clearLog = () => {
  logContent.value = '';
  logPath.value = '';
};

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      logContent.value = text;
      isInputMode.value = false;
    }
  } catch (err) {
    console.error('Failed to read clipboard', err);
  }
};

interface Extraction {
  searchId: string;
  resultSql: string;
}

const extractions = ref<Extraction[]>([{ searchId: '', resultSql: '' }]);

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
  return h;
};

const loadFromFile = async () => {
    const trimmedPath = logPath.value.trim();
    if (!trimmedPath) return;
    try {
      const content = await invoke<string>('read_file_content', { path: trimmedPath });
      logContent.value = content;
      isInputMode.value = false;
      nextTick(() => {
        setTimeout(() => {
          if (logDisplayRef.value) logDisplayRef.value.scrollTop = logDisplayRef.value.scrollHeight;
        }, 100);
      });
    } catch (e) {
      alert(`Error loading file: ${e}`);
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

  // Look for SQL and Params associated with the ID
  // We scan all lines because SQL and Params might be on different lines
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
      // Split parameters by '][' or ',' (depending on log format)
      // The user's example: [STRING:1:jp.co...][STRING:2:INFO]
      const paramParts = foundParams.match(/\[?([^\]\[]+)\]?/g) || foundParams.split(',');
      
      const formattedParams = paramParts.map(p => {
        let clean = p.replace(/[\[\]]/g, '').trim();
        // Handle [TYPE:INDEX:VALUE] format
        const parts = clean.split(':');
        if (parts.length >= 3) {
          return parts.slice(2).join(':'); // The value
        }
        return clean;
      });

      formattedParams.forEach(p => {
        result = result.replace('?', `'${p}'`);
      });
    }
    // Decode common entities and collapse multiple whitespaces
    let decoded = result.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
    extractions.value[index].resultSql = decoded.replace(/\s+/g, ' ').trim();
  } else {
    extractions.value[index].resultSql = '-- No SQL found for this ID';
  }
};

const formatSql = (index: number) => {
  let sql = extractions.value[index].resultSql;
  if (!sql || sql.startsWith('--')) return;

  // 1. Normalize: space out parentheses and collapse extra whitespace
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
      // Handle multi-word keywords
      if (['ORDER', 'GROUP', 'DELETE'].includes(upperToken)) {
        const next = tokens[i+1]?.toUpperCase();
        if ((upperToken === 'DELETE' && next === 'FROM') || (upperToken !== 'DELETE' && next === 'BY')) {
          combinedToken += ' ' + tokens[++i];
        }
      } else if (upperToken === 'INSERT' && tokens[i+1]?.toUpperCase() === 'INTO') {
        combinedToken += ' ' + tokens[++i];
      }
      
      // Start new line for keywords unless it's the very first token
      if (result.length > 0) {
        result = result.trimEnd() + '\n' + indentStep.repeat(indentLevel);
      }
      result += combinedToken + ' ';
    } else if (token === '(') {
      // Opening paren: increase indent and start new line
      result = result.trimEnd() + ' (\n' + indentStep.repeat(++indentLevel);
    } else if (token === ')') {
      // Closing paren: decrease indent and start new line before paren
      indentLevel = Math.max(0, indentLevel - 1);
      result = result.trimEnd() + '\n' + indentStep.repeat(indentLevel) + ') ';
    } else if (token === ',') {
      // After comma, just a space (could add newline for multi-field SELECTs if needed later)
      result = result.trimEnd() + ', ';
    } else {
      result += token + ' ';
    }
  }
  
  extractions.value[index].resultSql = result.trim().replace(/ +\n/g, '\n');
};

const copyResult = (text: string) => navigator.clipboard.writeText(text);

const handleLogClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('clickable-id')) {
    const id = target.getAttribute('data-id');
    if (id) {
       // Search for existing ID in extractions and remove it if found
       const existingIdx = extractions.value.findIndex(ex => ex.searchId.toLowerCase() === id.toLowerCase());
       if (existingIdx !== -1) {
         extractions.value.splice(existingIdx, 1);
       }
       
       // Try to find an empty slot first to avoid growing the list indefinitely
       let emptyIdx = extractions.value.findIndex(ex => !ex.searchId);
       if (emptyIdx === -1) {
         extractions.value.push({ searchId: id, resultSql: '' });
         emptyIdx = extractions.value.length - 1;
       } else {
         extractions.value[emptyIdx].searchId = id;
       }
       processSql(emptyIdx);
    }
  }
};

const formattedLog = computed(() => {
  const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
  let decoded = logContent.value.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
  let html = escapeHtml(decoded);
  if (logContent.value.length > 500000) return html;
  // Support id=..., id=(...), and uniq_id=(...)
  return html.replace(/(?:(uniq_id\s*=\s*\()([^)]+)(\))|(id\s*=\s*)([a-zA-Z0-9_-]+))/gi, (match, uniqPre, uniqId, uniqPost, idPre, idVal) => {
    const actualId = uniqId || idVal;
    const extra = existingIds.value.has(actualId.toLowerCase()) ? ' existing-id' : '';
    if (uniqId) {
      return `${uniqPre}<span class="clickable-id${extra}" data-id="${uniqId}">${uniqId}</span>${uniqPost}`;
    }
    return `${idPre}<span class="clickable-id${extra}" data-id="${idVal}">${idVal}</span>`;
  });
});

const isLogTooLarge = computed(() => logContent.value.length > 500000);
</script>

<template>
  <div class="sql-helper-container">
    <div class="control-bar">
      <div class="file-picker-group">
        <button @click="chooseFile" class="theme-button choose-btn">📂 Open Log</button>
        <span v-if="logPath" class="file-path-display">{{ logPath.split(/[\\/]/).pop() }}</span>
      </div>
      <div class="action-group">
        <button @click="clearAllExtractions" class="theme-button clear-all-btn">🗑 Clear All</button>
        <button @click="() => extractions.push({searchId:'', resultSql:''})" class="theme-button add-query-btn">＋ Add Query</button>
      </div>
    </div>

    <div class="sql-helper-split">
      <div class="log-viewer-pane">
        <div class="pane-header">
          <div class="header-left">
            <span>Log Viewer</span>
            <div class="mode-toggles">
              <button @click="isInputMode = false" :class="['mode-btn', !isInputMode ? 'active' : '']" title="Interactive View">👁 View</button>
              <button @click="isInputMode = true" :class="['mode-btn', isInputMode ? 'active' : '']" title="Edit/Paste">✏️ Edit</button>
            </div>
          </div>
          <div class="header-actions">
            <button @click="pasteFromClipboard" class="mini-icon-btn" title="Paste from Clipboard">📋</button>
            <button @click="clearLog" class="mini-icon-btn" title="Clear All">🗑</button>
            <button v-if="logPath" @click="loadFromFile" class="refresh-log-btn" title="Reload File">🔄</button>
          </div>
        </div>
        
        <div class="log-pane-content">
          <textarea 
            v-if="isInputMode" 
            v-model="logContent" 
            class="log-editor" 
            placeholder="Paste your log data here..."
          ></textarea>
          <div 
            v-else 
            class="log-display" 
            ref="logDisplayRef" 
            @click="handleLogClick" 
            v-html="formattedLog"
          ></div>
          
          <div v-if="!isInputMode && isLogTooLarge" class="log-warning-overlay">
            ⚠️ Log is too large for interactive highlighting.
          </div>
        </div>
      </div>

      <div class="extraction-pane">
        <div class="pane-header">SQL Extractions</div>
        <div class="extraction-list">
          <div v-for="(ext, i) in extractions" :key="i" class="extraction-unit">
            <div class="unit-header">
              <input v-model="ext.searchId" @keyup.enter="processSql(i)" class="theme-input mini-id" placeholder="id=..." />
              <div class="unit-actions">
                <button @click="removeExtraction(i)" class="remove-btn" title="Remove">&times;</button>
              </div>
            </div>
            <div v-if="ext.resultSql" class="result-area">
              <div class="result-toolbar">
                <span>Result SQL</span>
                <div class="toolbar-btns">
                  <button @click="formatSql(i)" class="format-btn">Format</button>
                  <button @click="copyResult(ext.resultSql)" class="copy-btn">Copy</button>
                </div>
              </div>
              <pre class="sql-output"><code v-html="highlightSql(ext.resultSql)"></code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sql-helper-container { display: flex; flex-direction: column; height: 100%; background: var(--main-bg); overflow: hidden; }
.control-bar { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: var(--border-style); }
.file-picker-group { display: flex; align-items: center; gap: 12px; }
.file-path-display { font-size: 0.85rem; opacity: 0.7; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-group { display: flex; gap: 10px; }
.clear-all-btn { border-color: #ef4444; color: #ef4444; }
.clear-all-btn:hover { background: rgba(239, 68, 68, 0.1); }

.sql-helper-split { display: flex; flex: 1; overflow: hidden; }
.log-viewer-pane { flex: 1; display: flex; flex-direction: column; border-right: var(--border-style); }
.extraction-pane { flex: 1; display: flex; flex-direction: column; background: var(--container-bg); }
.pane-header { padding: 8px 15px; background: var(--button-bg); border-bottom: var(--border-style); font-weight: bold; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; min-height: 40px; }
.header-left { display: flex; align-items: center; gap: 15px; }
.mode-toggles { display: flex; background: var(--input-bg); border-radius: 4px; padding: 2px; }
.mode-btn { 
  background: none; border: none; font-size: 0.7rem; padding: 2px 8px; color: var(--text-color); opacity: 0.6; cursor: pointer; border-radius: 3px; border: 1px solid transparent; transition: all 0.2s; 
}
.mode-btn.active { opacity: 1; background: var(--button-bg); border-color: var(--accent-color); color: var(--accent-color); font-weight: bold; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.mini-icon-btn { background: none; border: 1px solid transparent; cursor: pointer; font-size: 1rem; padding: 2px 4px; border-radius: 4px; filter: grayscale(1); opacity: 0.7; }
.mini-icon-btn:hover { background: var(--input-bg); border-color: var(--border-color); opacity: 1; filter: none; }

.log-pane-content { flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.log-display { flex: 1; padding: 15px; font-family: 'Consolas', monospace; font-size: 0.85rem; overflow-y: auto; white-space: pre-wrap; word-break: break-all; background: var(--input-bg); }
.log-editor { 
  flex: 1; width: 100%; border: none; background: var(--input-bg); color: var(--text-color); padding: 15px; 
  font-family: 'Consolas', monospace; font-size: 0.85rem; resize: none; outline: none;
}
.log-warning-overlay {
  position: absolute; bottom: 10px; right: 20px; background: rgba(245, 158, 11, 0.9);
  color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;
  pointer-events: none; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}
.extraction-list { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.extraction-unit { border: var(--border-style); border-radius: 8px; padding: 12px; background: var(--main-bg); }
.unit-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.mini-id { flex: 1; min-width: 0; }
.remove-btn { background: none; border: none; color: #ef4444; font-size: 1.5rem; cursor: pointer; line-height: 1; padding: 0 5px; }
.result-area { margin-top: 10px; }
.result-toolbar { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; opacity: 0.7; margin-bottom: 5px; }
.toolbar-btns { display: flex; gap: 8px; }
.format-btn, .copy-btn { 
  background: var(--button-bg); border: 1px solid var(--accent-color); 
  color: var(--accent-color); padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;
}
.format-btn:hover, .copy-btn:hover { background: var(--accent-color); color: white; }
.sql-output { margin: 0; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; overflow-x: auto; border-radius: 4px; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; }
:deep(.clickable-id) { color: var(--accent-color); text-decoration: underline; cursor: pointer; }
:deep(.clickable-id.existing-id) { font-weight: bold; color: #f59e0b; }
:deep(.sql-kwd) { color: #569cd6; font-weight: bold; }
:deep(.sql-tbl) { color: #4ec9b0; font-weight: bold; text-decoration: underline; }
:deep(.sql-str) { color: #ce9178; }
.theme-button { padding: 6px 12px; border-radius: 4px; border: var(--border-style); background: var(--button-bg); color: var(--text-color); cursor: pointer; font-size: 0.85rem; }
.choose-btn { background: var(--accent-color); color: white; border: none; }
.add-query-btn { border-color: var(--accent-color); color: var(--accent-color); }
.theme-input { padding: 6px 10px; border-radius: 4px; border: var(--border-style); background: var(--input-bg); color: var(--text-color); font-size: 0.85rem; }
.refresh-log-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0 5px; }
</style>