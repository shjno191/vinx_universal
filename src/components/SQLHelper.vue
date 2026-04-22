<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { activeTab } from '../store';
import { Icons } from '../utils/icons';
import { useSQLHelper } from '../composables/useSQLHelper';

const {
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
} = useSQLHelper();

const logDisplayRef = ref<HTMLElement | null>(null);
let highlightTimeout: any = null;

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

watch([logContent, activeTab], () => {
  if (highlightTimeout) clearTimeout(highlightTimeout);
  if (activeTab.value !== 'SQL-Helper') return;

  highlightTimeout = setTimeout(() => {
    updateDisplayHtml();
  }, 500);
}, { immediate: true });

onMounted(() => {
  if (activeTab.value === 'SQL-Helper') updateDisplayHtml();
});
</script>

<template>
  <div class="sql-helper-container">
    <div class="control-bar glass">
      <div class="file-picker-group">
        <button @click="chooseFile" class="theme-button choose-btn">
          <span v-html="Icons.Folder" class="btn-icon"></span>
          Open Log
        </button>
        <span v-if="logPath" class="file-path-display">{{ logPath.split(/[\\/]/).pop() }}</span>
      </div>
      <div class="action-group">
        <button @click="clearAllExtractions" class="theme-button clear-all-btn">
          <span v-html="Icons.Trash" class="btn-icon"></span>
          Clear All
        </button>
        <button @click="() => extractions.push({searchId:'', resultSql:''})" class="theme-button add-query-btn">
          <span v-html="Icons.Plus" class="btn-icon"></span>
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
              <span v-html="Icons.Copy"></span>
            </button>
            <button @click="clearLog" class="mini-icon-btn" title="Clear All">
              <span v-html="Icons.Trash"></span>
            </button>
            <button v-if="logPath" @click="loadFromFile" class="mini-icon-btn refresh-btn" title="Reload File">
              <span v-html="Icons.Refresh"></span>
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