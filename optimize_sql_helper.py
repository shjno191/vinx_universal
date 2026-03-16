# -*- coding: utf-8 -*-
import os

file_path = r'd:\vinx_tools\vinx_universal\src\components\SQLHelper.vue'

# Wide Plus: \uFF0B
wide_plus = chr(0xFF0B)
# Folder: \U0001F4C2
folder_icon = chr(0x1F4C2)
# Refresh: \U0001F504
refresh_icon = chr(0x1F504)
# File/Page: \U0001F4C4
file_icon = chr(0x1F4C4)

code_content = r"""<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { remoteConfigs, type RemoteConfig } from '../store';

const logPath = ref('');
const logContent = ref('');
const logDisplayRef = ref<HTMLElement | null>(null);
const currentRemoteSource = ref<RemoteConfig | null>(null);

interface Extraction {
  searchId: string;
  resultSql: string;
}

const extractions = ref<Extraction[]>([
  { searchId: '', resultSql: '' }
]);

const existingIds = computed(() => {
  const ids = new Set<string>();
  const matches = logContent.value.matchAll(/id\s*=\s*([a-zA-Z0-9_-]+)/gi);
  for (const m of matches) if (m[1]) ids.add(m[1].toLowerCase());
  return ids;
});

const getSshConfig = (cfg: RemoteConfig) => ({
  host: cfg.host,
  port: cfg.port || 22,
  username: cfg.username,
  password: cfg.password || null
});

const loadFromFile = async () => {
  const trimmedPath = logPath.value.trim();
  if (!trimmedPath) return;
  try {
    let content = '';
    if (currentRemoteSource.value) {
      content = await invoke('read_remote_file_content', { 
        config: getSshConfig(currentRemoteSource.value), 
        path: trimmedPath 
      });
    } else {
      content = await invoke('read_file_content', { path: trimmedPath });
    }
    logContent.value = content;
    nextTick(() => {
      if (logDisplayRef.value) {
        logDisplayRef.value.scrollTop = logDisplayRef.value.scrollHeight;
      }
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
      currentRemoteSource.value = null;
      logPath.value = selected;
      await loadFromFile();
    }
  } catch (e) {
    console.error('Failed to open file dialog', e);
  }
};

const showFileBrowser = ref(false);
const browserFileList = ref<string[]>([]);
const currentBrowserRemote = ref<RemoteConfig | null>(null);

const openFileBrowser = async (cfg: RemoteConfig) => {
  const sanitizedPath = cfg.targetPath?.trim() || '';
  if (!sanitizedPath) {
    alert("Please configure a Remote Log Path in Settings first.");
    return;
  }
  try {
    currentBrowserRemote.value = cfg;
    const files = await invoke<string[]>('list_remote_files', { 
      config: getSshConfig(cfg), 
      path: sanitizedPath 
    });
    browserFileList.value = files.filter(f => !f.toLowerCase().endsWith('.exe') && !f.toLowerCase().endsWith('.dll'));
    showFileBrowser.value = true;
  } catch (e) {
    alert("Failed to list remote files: " + e);
  }
};

const selectBrowserFile = async (file: string) => {
  if (!currentBrowserRemote.value) return;
  const cfg = currentBrowserRemote.value;
  const sanitizedPath = (cfg.targetPath || '').trim();
  const sep = sanitizedPath.includes('/') ? '/' : '\\';
  logPath.value = sanitizedPath.replace(/[\\\/]+$/, '') + sep + file;
  currentRemoteSource.value = cfg;
  showFileBrowser.value = false;
  await loadFromFile();
};

const processSql = (index: number) => {
  const idToFind = extractions.value[index].searchId.trim().toLowerCase();
  if (!idToFind) return;
  const lines = logContent.value.split(/\r?\n/);
  let foundSql = '', foundParams = '';
  const idPattern = new RegExp(`id\\s*=\\s*${idToFind}`, 'i');
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (idPattern.test(lines[i])) {
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
      if (idx === -1) {
        extractions.value.push({ searchId: id, resultSql: '' });
        idx = extractions.value.length - 1;
      } else {
        extractions.value[idx].searchId = id;
      }
      processSql(idx);
    }
  }
};

const formattedLog = computed(() => {
  const htmlMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  const escapeHtml = (str: string) => str.replace(/[&<>"']/g, m => htmlMap[m]);
  let html = escapeHtml(logContent.value);
  return html.replace(/(id\s*=\s*)([a-zA-Z0-9_-]+)/gi, (_, p, id) => {
    const extra = existingIds.value.has(id.toLowerCase()) ? ' existing-id' : '';
    return `${p}<span class="clickable-id${extra}" data-id="${id}">${id}</span>`;
  });
});
</script>

<template>
  <div class="sql-helper-container">
    <div class="control-bar">
      <div class="file-picker-group">
        <button @click="chooseFile" class="theme-button choose-btn">""" + folder_icon + r""" Open Log</button>
        <span v-if="logPath" class="file-path-display">{{ logPath.split(/[\\/]/).pop() }}</span>
        
        <div v-if="remoteConfigs.length > 0" class="remote-hints-inline">
          <span v-for="cfg in remoteConfigs.filter(c => c.enabled)" 
            :key="cfg.label" 
            class="remote-tag-mini" 
            @click="openFileBrowser(cfg)"
            :title="'Browse Remote SSH: ' + cfg.label"
          >
            """ + folder_icon + r""" {{ cfg.label }}
          </span>
        </div>
      </div>
      <button @click="() => extractions.push({searchId:'', resultSql:''})" class="theme-button add-query-btn">""" + wide_plus + r""" Add Query</button>
    </div>

    <div class="sql-helper-split">
      <div class="log-viewer-pane">
        <div class="pane-header">
          <span>Log Viewer <span v-if="currentRemoteSource" style="opacity:0.5; font-weight:normal;">(Remote: {{currentRemoteSource.label}})</span></span>
          <button v-if="logPath" @click="loadFromFile" class="refresh-log-btn" title="Reload File">""" + refresh_icon + r"""</button>
        </div>
        <div class="log-display" ref="logDisplayRef" @click="handleLogClick" v-html="formattedLog"></div>
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

    <div v-if="showFileBrowser" class="modal-overlay" @click.self="showFileBrowser = false">
      <div class="file-browser-modal">
        <div class="modal-header">
          <span>Select Remote Log File - {{ currentBrowserRemote?.label }}</span>
          <button class="close-modal-btn" @click="showFileBrowser = false">&times;</button>
        </div>
        <div class="modal-body file-list-container">
          <div v-if="browserFileList.length === 0" class="empty-list">No files found on remote server.</div>
          <div v-for="f in browserFileList" :key="f" class="file-item" @click="selectBrowserFile(f)">
            <span class="file-icon">""" + file_icon + r"""</span> {{ f }}
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

.remote-hints-inline { display: flex; gap: 6px; border-left: var(--border-style); padding-left: 12px; margin-left: 4px; }
.remote-tag-mini { 
  font-size: 0.7rem; padding: 2px 8px; background: var(--button-bg); border: var(--border-style); border-radius: 4px; 
  cursor: pointer; transition: all 0.2s; white-space: nowrap; max-width: 100px; overflow: hidden; text-overflow: ellipsis;
}
.remote-tag-mini:hover { border-color: var(--accent-color); color: var(--accent-color); background: rgba(99,102,241,0.1); }

.sql-helper-split { display: flex; flex: 1; overflow: hidden; }
.log-viewer-pane { flex: 1.5; display: flex; flex-direction: column; border-right: var(--border-style); }
.extraction-pane { flex: 1; display: flex; flex-direction: column; background: var(--container-bg); }
.pane-header { padding: 8px 15px; background: var(--button-bg); border-bottom: var(--border-style); font-weight: bold; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; }
.log-display { flex: 1; padding: 15px; font-family: 'Consolas', monospace; font-size: 0.85rem; overflow-y: auto; white-space: pre-wrap; word-break: break-all; background: var(--input-bg); }
.extraction-list { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.extraction-unit { border: var(--border-style); border-radius: 8px; padding: 12px; background: var(--main-bg); cursor: default; }
.unit-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.mini-id { flex: 1; min-width: 0; }
.remove-btn { background: none; border: none; color: #ef4444; font-size: 1.25rem; cursor: pointer; }
.result-area { margin-top: 10px; }
.result-toolbar { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; opacity: 0.7; }
.sql-output { margin: 0; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; overflow-x: auto; border-radius: 4px; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.file-browser-modal { background: var(--container-bg); width: 500px; max-height: 70vh; border-radius: 8px; display: flex; flex-direction: column; }
.modal-header { padding: 12px 15px; border-bottom: var(--border-style); display: flex; justify-content: space-between; align-items: center; }
.close-modal-btn { background: none; border: none; color: var(--text-color); font-size: 1.5rem; cursor: pointer; }
.file-list-container { overflow-y: auto; padding: 10px; }
.file-item { padding: 8px 12px; cursor: pointer; border-radius: 4px; }
.file-item:hover { background: rgba(99,102,241,0.1); }
:deep(.clickable-id) { color: var(--accent-color); text-decoration: underline; cursor: pointer; }
:deep(.clickable-id.existing-id) { font-weight: bold; }
.theme-button { padding: 6px 12px; border-radius: 4px; border: var(--border-style); background: var(--button-bg); color: var(--text-color); cursor: pointer; font-size: 0.85rem; }
.choose-btn { background: var(--accent-color); color: white; border: none; }
.add-query-btn { border-color: var(--accent-color); color: var(--accent-color); }
.theme-input { padding: 6px 10px; border-radius: 4px; border: var(--border-style); background: var(--input-bg); color: var(--text-color); font-size: 0.85rem; }
.refresh-log-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0 5px; }
</style>
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code_content)
print("Successfully optimized SQLHelper.vue.")
