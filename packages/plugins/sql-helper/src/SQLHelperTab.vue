<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { activeTab, Icons } from '@vinx/sdk';
import { useSQLHelper } from './useSQLHelper';

const {
  logPath,
  logContent,
  extractions,
  displayHtml,
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
  extractById
} = useSQLHelper();

const logDisplayRef = ref<HTMLElement | null>(null);

const copyResult = (text: string) => navigator.clipboard.writeText(text);

const handleLogClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const linkEl = target.closest('.clickable-id') as HTMLElement | null;
  if (linkEl) {
    const id = linkEl.getAttribute('data-id');
    if (id) {
      extractById(id);
    }
  }
};

const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  logContent.value = text;
  updateDisplayHtml();
};

watch([logContent, activeTab], () => {
  if (activeTab.value !== 'SQL-Helper') return;
  updateDisplayHtml();
}, { immediate: true });

onMounted(() => {
  if (activeTab.value === 'SQL-Helper') {
    updateDisplayHtml();
  }
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
        <span v-if="logPath" class="file-path-display" :title="logPath">{{ logPath.split(/[\\/]/).pop() }}</span>
      </div>
      <div class="action-group">
        <button v-if="extractions.length > 0" @click="clearAllExtractions" class="theme-button clear-all-btn">
          <span v-html="Icons.Trash" class="btn-icon"></span>
          Clear All ({{ extractions.length }})
        </button>
      </div>
    </div>

    <div class="sql-helper-split">
      <div class="log-viewer-pane border-right">
        <div class="pane-header glass-header">
          <div class="header-left">
            <span class="pane-title">LOG VIEWER</span>
          </div>
          <div class="header-actions">
            <button @click="pasteFromClipboard" class="mini-icon-btn" title="Paste from Clipboard (Ctrl+V)">
              <span v-html="Icons.Copy"></span>
            </button>
            <button @click="clearLog" class="mini-icon-btn" title="Clear Log">
              <span v-html="Icons.Trash"></span>
            </button>
            <button v-if="logPath" @click="loadFromFile" class="mini-icon-btn refresh-btn" title="Reload File">
              <span v-html="Icons.Refresh"></span>
            </button>
          </div>
        </div>
        
        <div class="log-pane-content" @paste="handlePaste">
          <div 
            v-if="logContent"
            class="log-display" 
            ref="logDisplayRef" 
            tabindex="0"
            @click="handleLogClick" 
            @paste="handlePaste"
            v-html="displayHtml"
          ></div>

          <div v-else class="empty-log-overlay" @click="pasteFromClipboard">
            <div class="empty-log-box">
              <span class="empty-log-icon">📋</span>
              <span class="empty-log-title">Paste your log here (Ctrl+V) or click Open Log</span>
              <span class="empty-log-sub">IDs will be formatted as clickable links to extract SQL</span>
            </div>
          </div>
          
          <div v-if="isLogTooLarge" class="log-warning-overlay">
            ⚠️ Large log loaded (>200KB). Showing raw text for performance.
          </div>
        </div>
      </div>

      <div class="extraction-pane">
        <div class="pane-header glass-header">
          <span class="pane-title">SQL EXTRACTIONS</span>
          <span v-if="extractions.length > 0" class="extraction-count">{{ extractions.length }}</span>
        </div>
        <div class="extraction-list">
          <div v-if="extractions.length === 0" class="empty-extractions">
            <div class="empty-icon">⚡</div>
            <div class="empty-title">No SQL Extracted Yet</div>
            <div class="empty-desc">Click any highlighted ID link in the log to extract and format its SQL query.</div>
          </div>

          <div v-for="(ext, i) in extractions" :key="i" class="extraction-unit glass">
            <div class="unit-header">
              <div class="extraction-id-badge">
                <span class="badge-bolt">⚡</span>
                <span class="badge-text" :title="ext.searchId">{{ ext.searchId }}</span>
              </div>
              <div class="unit-actions">
                <button @click="removeExtraction(i)" class="remove-btn" title="Remove Extraction">&times;</button>
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
.file-path-display { font-size: 0.75rem; opacity: 0.6; font-weight: 700; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-group { display: flex; gap: 10px; }

.btn-icon { margin-right: 6px; }

.sql-helper-split { display: flex; flex: 1; overflow: hidden; gap: 12px; }
.log-viewer-pane { flex: 1.2; display: flex; flex-direction: column; background: var(--container-bg); border-radius: 12px; border: 1px solid rgba(128, 128, 128, 0.1); overflow: hidden; }
.extraction-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pane-header { padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; min-height: 40px; flex-shrink: 0; }
.pane-title { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em; color: var(--accent-color); opacity: 0.8; }
.header-left { display: flex; align-items: center; gap: 12px; }
.extraction-count { font-size: 0.65rem; background: rgba(99, 102, 241, 0.15); color: var(--accent-color); padding: 2px 8px; border-radius: 12px; font-weight: 700; }

.header-actions { display: flex; align-items: center; gap: 8px; }
.mini-icon-btn { background: rgba(128, 128, 128, 0.1); border: 1px solid rgba(128, 128, 128, 0.15); cursor: pointer; color: var(--text-color); padding: 6px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
.mini-icon-btn:hover { background: rgba(128, 128, 128, 0.2); opacity: 1; transform: translateY(-1px); }

.log-pane-content { flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; }

.empty-log-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  cursor: pointer;
  user-select: none;
}
.empty-log-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  opacity: 0.6;
  border: 2px dashed rgba(128, 128, 128, 0.25);
  border-radius: 12px;
  padding: 40px 30px;
  transition: all 0.2s;
  width: 80%;
  max-width: 400px;
}
.empty-log-box:hover {
  opacity: 1;
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.05);
}
.empty-log-icon { font-size: 2.2rem; }
.empty-log-title { font-size: 0.85rem; font-weight: 700; color: var(--text-color); }
.empty-log-sub { font-size: 0.72rem; opacity: 0.7; }

.log-display { 
  flex: 1; 
  padding: 15px; 
  font-family: 'Consolas', monospace; 
  font-size: 0.8rem; 
  line-height: 1.6; 
  overflow-y: auto; 
  white-space: pre-wrap; 
  word-break: break-all; 
  background: transparent; 
  color: var(--text-color); 
  outline: none;
}


.editable-log:empty::before {
  content: attr(data-placeholder);
  color: var(--text-color);
  opacity: 0.35;
  pointer-events: none;
}

.log-warning-overlay {
  position: absolute; bottom: 10px; right: 20px; background: rgba(245, 158, 11, 0.9);
  color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.65rem; font-weight: bold;
  pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.extraction-list { flex: 1; overflow-y: auto; padding: 0; display: flex; flex-direction: column; gap: 15px; }

.empty-extractions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  opacity: 0.6;
}
.empty-icon { font-size: 2rem; margin-bottom: 10px; opacity: 0.5; }
.empty-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 5px; color: var(--text-color); }
.empty-desc { font-size: 0.75rem; max-width: 280px; line-height: 1.4; }

.extraction-unit { border: 1px solid rgba(128, 128, 128, 0.1); border-radius: 12px; padding: 12px; transition: all 0.3s; }
.extraction-unit:hover { border-color: var(--accent-color); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.unit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.extraction-id-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 6px;
  padding: 4px 10px;
  color: var(--accent-color);
  font-weight: 700;
  font-size: 0.75rem;
  max-width: 85%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-bolt { font-size: 0.75rem; }
.badge-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.remove-btn { background: transparent; border: none; color: #f43f5e; font-size: 1.2rem; cursor: pointer; opacity: 0.4; transition: 0.2s; padding: 2px 6px; border-radius: 4px; }
.remove-btn:hover { opacity: 1; transform: scale(1.1); background: rgba(244, 63, 94, 0.1); }

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

/* --- In-Text ID Links & Prominent Selection Highlighting --- */
:deep(.clickable-id) { 
  color: #38bdf8; 
  text-decoration: underline; 
  cursor: pointer; 
  font-weight: 700; 
  padding: 1px 4px;
  border-radius: 4px;
  transition: all 0.15s ease-in-out;
}
:deep(.clickable-id:hover) {
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
  text-decoration: underline;
}

/* Real fluorescent highlight when ID is clicked/selected */
:deep(.clickable-id.existing-id) { 
  color: #0f172a !important;
  background: #facc15 !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.7) !important;
  border: 1px solid #eab308 !important;
  display: inline-block !important;
}

:deep(.sql-kwd) { color: #569cd6; font-weight: bold; }

/* --- Prominent RED Table Name Highlighting --- */
:deep(.sql-tbl) { 
  color: #ff3344 !important; 
  background: rgba(255, 51, 68, 0.15) !important;
  border: 1px solid rgba(255, 51, 68, 0.45) !important;
  padding: 1px 7px !important;
  border-radius: 4px !important;
  font-weight: 800 !important;
  letter-spacing: 0.02em !important;
  display: inline-block !important;
  margin: 0 2px !important;
  text-shadow: 0 0 8px rgba(255, 51, 68, 0.35) !important;
}

:deep(.sql-str) { color: #ce9178; }

.theme-button { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(128, 128, 128, 0.2); background: rgba(128, 128, 128, 0.1); color: var(--text-color); cursor: pointer; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; transition: all 0.2s; }
.theme-button:hover { background: rgba(128, 128, 128, 0.2); transform: translateY(-1px); }

.choose-btn { background: var(--accent-color); color: white; border: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.choose-btn:hover { background: #6366f1; box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }

.clear-all-btn { color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); }
.clear-all-btn:hover { background: rgba(244, 63, 94, 0.1); }

/* Theme specific overrides */
.theme-light .glass { background: rgba(255, 255, 255, 0.7); border-color: rgba(0,0,0,0.1); }
.theme-light .log-viewer-pane { background: #fff; }
.theme-light .sql-output { background-color: #f1f5f9; color: #1e293b; border-color: #e2e8f0; }
.theme-light :deep(.sql-tbl) {
  color: #dc2626 !important;
  background: rgba(220, 38, 38, 0.12) !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
  text-shadow: none !important;
}

/* Windows 95 Theme Overrides */
.theme-95 .glass, .theme-95 .glass-header, .theme-95 .extraction-unit { 
  background: #c0c0c0 !important; 
  border: 2px solid !important; 
  border-color: #fff #808080 #808080 #fff !important; 
  border-radius: 0 !important; 
  backdrop-filter: none !important; 
}
.theme-95 .theme-button, .theme-95 .mini-icon-btn, .theme-95 .format-btn, .theme-95 .copy-btn { 
  border: 2px solid !important; 
  border-color: #fff #808080 #808080 #fff !important; 
  border-radius: 0 !important; 
  background: #c0c0c0 !important; 
  color: #000 !important; 
}
.theme-95 .log-viewer-pane,
.theme-95 .sql-output {
  background: #ffffff !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #808080 #fff #fff #808080 !important;
  border-radius: 0 !important;
}
.theme-95 :deep(.sql-kwd) {
  color: #0000aa !important;
  font-weight: bold !important;
}
.theme-95 :deep(.sql-str) {
  color: #7f0000 !important;
}
/* Win95 Red Table Highlighting: Razor-sharp, high-contrast, pure classic red badge */
.theme-95 :deep(.sql-tbl),
:root.theme-95 :deep(.sql-tbl),
.win95 :deep(.sql-tbl) {
  color: #cc0000 !important;
  background: #ffe5e5 !important;
  border: 1px solid #cc0000 !important;
  border-radius: 0 !important;
  font-weight: 900 !important;
  letter-spacing: 0.02em !important;
  text-shadow: none !important;
  padding: 1px 6px !important;
  margin: 0 2px !important;
  display: inline-block !important;
}
.theme-95 :deep(.clickable-id) {
  color: #0000cc !important;
  text-decoration: underline !important;
  font-weight: bold !important;
}
.theme-95 :deep(.clickable-id:hover) {
  background: #e0e7ff !important;
  color: #0000aa !important;
}
.theme-95 :deep(.clickable-id.existing-id) {
  color: #000000 !important;
  background: #ffff00 !important;
  border: 1px solid #808000 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  font-weight: 800 !important;
}
.theme-95 .extraction-id-badge {
  background: #000080 !important;
  color: #ffffff !important;
  border: 1px solid #000040 !important;
  border-radius: 0 !important;
}
</style>


