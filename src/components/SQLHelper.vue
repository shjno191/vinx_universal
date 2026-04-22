<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { activeTab } from '../store';
import { sanitize } from '../utils/security';


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
  
  return sanitize(h);
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
        if (parts.length >= 3) {
          return parts.slice(2).join(':'); 
        }
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

const copyResult = (text: string) => navigator.clipboard.writeText(text);

const handleLogClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('clickable-id')) {
    const id = target.getAttribute('data-id');
    if (id) {
       const existingIdx = extractions.value.findIndex(ex => ex.searchId.toLowerCase() === id.toLowerCase());
       if (existingIdx !== -1) {
         extractions.value.splice(existingIdx, 1);
       }
       
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

const isLogTooLarge = computed(() => logContent.value.length > 200000); // Reduced limit for better responsiveness

const displayHtml = ref('');
let highlightTimeout: any = null;

const updateDisplayHtml = () => {
  const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]||m));
  let decoded = logContent.value.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/#039;/g, "'");
  let html = escapeHtml(decoded);
  
  if (isLogTooLarge.value) {
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

watch([logContent, activeTab], () => {

  if (highlightTimeout) clearTimeout(highlightTimeout);
  if (activeTab.value !== 'SQL-Helper') return;

  highlightTimeout = setTimeout(() => {
    updateDisplayHtml();
  }, 500);
}, { immediate: true });

watch(activeTab, (newTab: string) => {
  if (newTab === 'SQL-Helper') {
    updateDisplayHtml();
  }
});
</script>

<template>
  <div class="sql-helper-container">
    <div class="control-bar glass">
      <div class="file-picker-group">
        <button @click="chooseFile" class="theme-button choose-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Open Log
        </button>
        <span v-if="logPath" class="file-path-display">{{ logPath.split(/[\\/]/).pop() }}</span>
      </div>
      <div class="action-group">
        <button @click="clearAllExtractions" class="theme-button clear-all-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          Clear All
        </button>
        <button @click="() => extractions.push({searchId:'', resultSql:''})" class="theme-button add-query-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Query
        </button>
      </div>
    </div>

    <div class="sql-helper-split">
      <div class="log-viewer-pane border-right">
        <div class="pane-header glass-header">
          <div class="header-left">
            <span class="pane-title">LOG VIEWER</span>
            <div class="mode-toggles">
              <button @click="isInputMode = false" :class="['mode-btn', !isInputMode ? 'active' : '']" title="Interactive View">VIEW</button>
              <button @click="isInputMode = true" :class="['mode-btn', isInputMode ? 'active' : '']" title="Edit/Paste">EDIT</button>
            </div>
          </div>
          <div class="header-actions">
            <button @click="pasteFromClipboard" class="mini-icon-btn" title="Paste from Clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            </button>
            <button @click="clearLog" class="mini-icon-btn" title="Clear All">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button v-if="logPath" @click="loadFromFile" class="mini-icon-btn refresh-btn" title="Reload File">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
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
            v-html="displayHtml"
          ></div>
          
          <div v-if="!isInputMode && isLogTooLarge" class="log-warning-overlay">
            ⚠️ Log is too large for interactive highlighting.
          </div>
        </div>
      </div>

      <div class="extraction-pane">
        <div class="pane-header glass-header">
           <span class="pane-title">SQL EXTRACTIONS</span>
        </div>
        <div class="extraction-list">
          <div v-for="(ext, i) in extractions" :key="i" class="extraction-unit glass">
            <div class="unit-header">
              <input v-model="ext.searchId" @keyup.enter="processSql(i)" class="theme-input mini-id" placeholder="ID to extract (e.g. jp.co...)" />
              <div class="unit-actions">
                <button @click="removeExtraction(i)" class="remove-btn" title="Remove">&times;</button>
              </div>
            </div>
            <div v-if="ext.resultSql" class="result-area">
              <div class="result-toolbar">
                <span class="result-label">RESULT SQL</span>
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
.sql-helper-container { display: flex; flex-direction: column; height: 100%; background: var(--bg-color); gap: 10px; box-sizing: border-box; overflow: hidden; padding: 10px 15px; }

.glass {
  background: rgba(128, 128, 128, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(128, 128, 128, 0.15);
  border-radius: 12px;
}

.glass-header {
  background: rgba(128, 128, 128, 0.08);
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 12px 12px 0 0;
}

.control-bar { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.file-picker-group { display: flex; align-items: center; gap: 12px; }
.file-path-display { font-size: 0.75rem; opacity: 0.6; font-weight: 700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-group { display: flex; gap: 10px; }

.btn-icon { margin-right: 6px; }

.sql-helper-split { display: flex; flex: 1; overflow: hidden; gap: 12px; }
.log-viewer-pane { flex: 1.2; display: flex; flex-direction: column; background: var(--container-bg); border-radius: 12px; border: 1px solid rgba(128, 128, 128, 0.1); }
.extraction-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pane-header { padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; min-height: 40px; flex-shrink: 0; }
.pane-title { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em; color: var(--accent-color); opacity: 0.8; }
.header-left { display: flex; align-items: center; gap: 15px; }
.mode-toggles { display: flex; background: rgba(0,0,0,0.1); border-radius: 50px; padding: 2px; }
.mode-btn { 
  background: none; border: none; font-size: 0.6rem; padding: 4px 12px; color: var(--text-color); opacity: 0.4; cursor: pointer; border-radius: 40px; font-weight: 800; transition: all 0.2s; 
}
.mode-btn.active { opacity: 1; background: #fff; color: #6366f1; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

.theme-light .mode-btn.active { color: #4f46e5; }

.header-actions { display: flex; align-items: center; gap: 8px; }
.mini-icon-btn { background: rgba(128, 128, 128, 0.1); border: 1px solid rgba(128, 128, 128, 0.15); cursor: pointer; color: var(--text-color); padding: 6px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
.mini-icon-btn:hover { background: rgba(128, 128, 128, 0.2); opacity: 1; transform: translateY(-1px); }

.log-pane-content { flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; }
.log-display { flex: 1; padding: 15px; font-family: 'Consolas', monospace; font-size: 0.8rem; line-height: 1.5; overflow-y: auto; white-space: pre-wrap; word-break: break-all; background: transparent; color: var(--text-color); }
.log-editor { 
  flex: 1; width: 100%; border: none; background: transparent; color: var(--text-color); padding: 15px; 
  font-family: 'Consolas', monospace; font-size: 0.8rem; line-height: 1.5; resize: none; outline: none;
}
.log-warning-overlay {
  position: absolute; bottom: 10px; right: 20px; background: rgba(245, 158, 11, 0.9);
  color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.65rem; font-weight: bold;
  pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.extraction-list { flex: 1; overflow-y: auto; padding: 0; display: flex; flex-direction: column; gap: 15px; }
.extraction-unit { border: 1px solid rgba(128, 128, 128, 0.1); border-radius: 12px; padding: 12px; transition: all 0.3s; }
.extraction-unit:hover { border-color: var(--accent-color); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.unit-header { display: flex; gap: 10px; align-items: center; margin-bottom: 5px; }
.mini-id { flex: 1; min-width: 0; }
.remove-btn { background: transparent; border: none; color: #f43f5e; font-size: 1.2rem; cursor: pointer; opacity: 0.4; transition: 0.2s; }
.remove-btn:hover { opacity: 1; transform: scale(1.1); }

.result-area { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(128,128,128,0.1); }
.result-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.result-label { font-size: 0.6rem; font-weight: 800; opacity: 0.4; letter-spacing: 0.05em; }

.toolbar-btns { display: flex; gap: 8px; }
.format-btn, .copy-btn { 
  background: rgba(128, 128, 128, 0.08); border: 1px solid rgba(128, 128, 128, 0.1); 
  color: var(--text-color); padding: 3px 10px; border-radius: 6px; cursor: pointer; font-size: 0.65rem; font-weight: 700; transition: 0.2s;
}
.format-btn:hover, .copy-btn:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); }

.sql-output { margin: 0; padding: 12px; background-color: rgba(0,0,0,0.2); color: #d4d4d4; overflow-x: auto; border-radius: 8px; font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; font-family: 'Consolas', monospace; border: 1px solid rgba(255,255,255,0.03); }

:deep(.clickable-id) { color: var(--accent-color); text-decoration: underline; cursor: pointer; font-weight: bold; }
:deep(.clickable-id.existing-id) { color: #f59e0b; }
:deep(.sql-kwd) { color: #569cd6; font-weight: bold; }
:deep(.sql-tbl) { color: #4ec9b0; font-weight: bold; text-decoration: underline; }
:deep(.sql-str) { color: #ce9178; }

.theme-button { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(128, 128, 128, 0.2); background: rgba(128, 128, 128, 0.1); color: var(--text-color); cursor: pointer; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; transition: all 0.2s; }
.theme-button:hover { background: rgba(128, 128, 128, 0.2); transform: translateY(-1px); }

.choose-btn { background: var(--accent-color); color: white; border: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.choose-btn:hover { background: #6366f1; box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }

.clear-all-btn { color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); }
.clear-all-btn:hover { background: rgba(244, 63, 94, 0.1); }

.add-query-btn { border-color: rgba(99, 102, 241, 0.3); color: var(--accent-color); }

.theme-input { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.15); background: rgba(0,0,0,0.1); color: var(--text-color); font-size: 0.75rem; outline: none; transition: 0.2s; }
.theme-input:focus { border-color: var(--accent-color); background: rgba(0,0,0,0.15); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }

/* Theme specific overrides */
.theme-light .glass { background: rgba(255, 255, 255, 0.7); border-color: rgba(0,0,0,0.1); }
.theme-light .log-viewer-pane { background: #fff; }
.theme-light .sql-output { background-color: #f1f5f9; color: #1e293b; border-color: #e2e8f0; }

.theme-95 .glass, .theme-95 .glass-header, .theme-95 .extraction-unit { background: #c0c0c0 !important; border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; border-radius: 0 !important; backdrop-filter: none !important; }
.theme-95 .theme-button, .theme-95 .mini-icon-btn, .theme-95 .format-btn, .theme-95 .copy-btn { border: 2px solid !important; border-color: #fff #808080 #808080 #fff !important; border-radius: 0 !important; background: #c0c0c0 !important; color: #000 !important; }
.theme-95 .theme-input { border: 2px solid !important; border-color: #808080 #fff #fff #808080 !important; border-radius: 0 !important; }
</style>