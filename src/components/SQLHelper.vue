<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const logPath = ref('');
const logContent = ref('');
const logDisplayRef = ref<HTMLElement | null>(null);

interface Extraction {
  searchId: string;
  resultSql: string;
}

const extractions = ref<Extraction[]>([{ searchId: '', resultSql: '' }]);

const existingIds = computed(() => {
  const ids = new Set<string>();
  if (logContent.value.length > 500000) return ids;
  const matches = logContent.value.matchAll(/id\s*=\s*([a-zA-Z0-9_-]+)/gi);
  for (const m of matches) if (m[1]) ids.add(m[1].toLowerCase());
  return ids;
});

const loadFromFile = async () => {
    const trimmedPath = logPath.value.trim();
    if (!trimmedPath) return;
    try {
      const content = await invoke<string>('read_file_content', { path: trimmedPath });
      logContent.value = content;
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
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].toLowerCase().includes(`id=${idToFind}`)) {
       const sqlMatch = lines[i].match(/sql\s*=\s*(.+?)(?=\s*,\s*\w+\s*=|$)/i);
       if (sqlMatch) foundSql = sqlMatch[1];
       const paramsMatch = lines[i].match(/params\s*=\s*(.+?)(?=\s*,\s*\w+\s*=|$)/i);
       if (paramsMatch) foundParams = paramsMatch[1];
       if (foundSql) break;
    }
  }
  if (foundSql) {
    let result = foundSql;
    if (foundParams) {
      foundParams.split(',').map(p => p.trim()).forEach(p => { result = result.replace('?', `'${p}'`); });
    }
    extractions.value[index].resultSql = result;
  } else {
    extractions.value[index].resultSql = '-- No SQL found for this ID';
  }
};

const copyResult = (text: string) => navigator.clipboard.writeText(text);

const handleLogClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('clickable-id')) {
    const id = target.getAttribute('data-id');
    if (id) {
       let idx = extractions.value.findIndex(ex => !ex.searchId);
       if (idx === -1) { extractions.value.push({ searchId: '', resultSql: '' }); idx = extractions.value.length - 1; }
       extractions.value[idx].searchId = id;
       processSql(idx);
    }
  }
};

const formattedLog = computed(() => {
  const escapeHtml = (u: string) => u.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'#039;'}[m]||m));
  let html = escapeHtml(logContent.value);
  if (logContent.value.length > 500000) return html;
  return html.replace(/(id\s*=\s*)([a-zA-Z0-9_-]+)/gi, (_, p, id) => {
    const extra = existingIds.value.has(id.toLowerCase()) ? ' existing-id' : '';
    return `${p}<span class="clickable-id${extra}" data-id="${id}">${id}</span>`;
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
      <button @click="() => extractions.push({searchId:'', resultSql:''})" class="theme-button add-query-btn">＋ Add Query</button>
    </div>

    <div class="sql-helper-split">
      <div class="log-viewer-pane">
        <div class="pane-header">
          <span>Log Viewer</span>
          <button v-if="logPath" @click="loadFromFile" class="refresh-log-btn" title="Reload File">🔄</button>
        </div>
        <div class="log-display" ref="logDisplayRef" @click="handleLogClick" v-html="formattedLog"></div>
        <div v-if="isLogTooLarge" class="log-warning-overlay">
          ⚠️ Log is too large for interactive highlighting.
        </div>
      </div>

      <div class="extraction-pane">
        <div class="pane-header">SQL Extractions</div>
        <div class="extraction-list">
          <div v-for="(ext, i) in extractions" :key="i" class="extraction-unit">
            <div class="unit-header">
              <input v-model="ext.searchId" @keyup.enter="processSql(i)" class="theme-input mini-id" placeholder="id=..." />
              <div class="unit-actions">
                <button @click="processSql(i)" class="theme-button get-btn">Extract</button>
                <button v-if="extractions.length > 1" @click="extractions.splice(i, 1)" class="remove-btn">&times;</button>
              </div>
            </div>
            <div v-if="ext.resultSql" class="result-area">
              <div class="result-toolbar"><span>Result SQL</span><button @click="copyResult(ext.resultSql)" class="copy-btn">Copy</button></div>
              <pre class="sql-output"><code>{{ ext.resultSql }}</code></pre>
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

.sql-helper-split { display: flex; flex: 1; overflow: hidden; }
.log-viewer-pane { flex: 1.5; display: flex; flex-direction: column; border-right: var(--border-style); }
.extraction-pane { flex: 1; display: flex; flex-direction: column; background: var(--container-bg); }
.pane-header { padding: 8px 15px; background: var(--button-bg); border-bottom: var(--border-style); font-weight: bold; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; }
.log-display { flex: 1; padding: 15px; font-family: 'Consolas', monospace; font-size: 0.85rem; overflow-y: auto; white-space: pre-wrap; word-break: break-all; background: var(--input-bg); position: relative; }
.log-warning-overlay {
  position: absolute; bottom: 10px; right: 20px; background: rgba(245, 158, 11, 0.9);
  color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;
  pointer-events: none; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}
.extraction-list { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.extraction-unit { border: var(--border-style); border-radius: 8px; padding: 12px; background: var(--main-bg); }
.unit-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.mini-id { flex: 1; min-width: 0; }
.remove-btn { background: none; border: none; color: #ef4444; font-size: 1.25rem; cursor: pointer; }
.result-area { margin-top: 10px; }
.result-toolbar { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; opacity: 0.7; }
.sql-output { margin: 0; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; overflow-x: auto; border-radius: 4px; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; }
:deep(.clickable-id) { color: var(--accent-color); text-decoration: underline; cursor: pointer; }
:deep(.clickable-id.existing-id) { font-weight: bold; }
.theme-button { padding: 6px 12px; border-radius: 4px; border: var(--border-style); background: var(--button-bg); color: var(--text-color); cursor: pointer; font-size: 0.85rem; }
.choose-btn { background: var(--accent-color); color: white; border: none; }
.add-query-btn { border-color: var(--accent-color); color: var(--accent-color); }
.theme-input { padding: 6px 10px; border-radius: 4px; border: var(--border-style); background: var(--input-bg); color: var(--text-color); font-size: 0.85rem; }
.refresh-log-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0 5px; }
</style>