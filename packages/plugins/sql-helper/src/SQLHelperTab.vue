<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { activeTab, theme as globalTheme, Icons } from '@vinx/sdk';
import { useSQLHelper } from './useSQLHelper';
import {
  formatSqlInEditor,
  highlightSqlForEditor,
  computeLineCount,
} from './sql-editor-helper';

const props = defineProps<{ theme?: string; isActive?: boolean; active?: boolean }>();

const activeSubTab = ref<'log' | 'sql'>('log');

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

// --- Sub-tab 2: Native Non-Blocking SQL Editor & Formatter ---
const sqlEditorContent = ref('');
const rawSqlBeforeFormat = ref<string | null>(null);
const isSqlFormatted = ref(false);
const copyFeedback = ref(false);

const sqlTextareaRef = ref<HTMLTextAreaElement | null>(null);
const sqlBackdropRef = ref<HTMLElement | null>(null);
const sqlGutterRef = ref<HTMLElement | null>(null);

const sqlEditorLineCount = computed(() => computeLineCount(sqlEditorContent.value));

const highlightedSqlEditorHtml = computed(() =>
  highlightSqlForEditor(sqlEditorContent.value)
);

const syncSqlEditorScroll = () => {
  const ta = sqlTextareaRef.value;
  if (!ta) return;
  if (sqlBackdropRef.value) {
    sqlBackdropRef.value.scrollTop = ta.scrollTop;
    sqlBackdropRef.value.scrollLeft = ta.scrollLeft;
  }
  if (sqlGutterRef.value) {
    sqlGutterRef.value.scrollTop = ta.scrollTop;
  }
};

const handleFormatSqlEditor = () => {
  const ta = sqlTextareaRef.value;
  const selStart = ta ? ta.selectionStart : undefined;
  const selEnd = ta ? ta.selectionEnd : undefined;

  const result = formatSqlInEditor({
    text: sqlEditorContent.value,
    rawBeforeFormat: rawSqlBeforeFormat.value,
    isFormatted: isSqlFormatted.value,
    selectionStart: selStart,
    selectionEnd: selEnd,
  });

  sqlEditorContent.value = result.text;
  rawSqlBeforeFormat.value = result.rawBeforeFormat;
  isSqlFormatted.value = result.isFormatted;

  nextTick(() => {
    syncSqlEditorScroll();
    ta?.focus();
  });
};

const handleSqlEditorKeyDown = (e: KeyboardEvent) => {
  // Format SQL shortcut: Ctrl+Alt+F or Shift+Alt+F
  if (
    e.altKey &&
    (e.ctrlKey || e.metaKey || e.shiftKey) &&
    (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')
  ) {
    e.preventDefault();
    e.stopPropagation();
    handleFormatSqlEditor();
    return;
  }

  // Insert tab character when pressing Tab inside the SQL editor
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    const ta = sqlTextareaRef.value;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const current = sqlEditorContent.value;
    sqlEditorContent.value = current.slice(0, start) + '\t' + current.slice(end);
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 1;
    });
  }
};

const pasteToSqlEditor = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    sqlEditorContent.value = text;
    isSqlFormatted.value = false;
    rawSqlBeforeFormat.value = null;
    nextTick(() => {
      syncSqlEditorScroll();
      sqlTextareaRef.value?.focus();
    });
  } catch (err) {
    console.error('Failed to paste from clipboard:', err);
  }
};

const copySqlEditorContent = async () => {
  if (!sqlEditorContent.value) return;
  await navigator.clipboard.writeText(sqlEditorContent.value);
  copyFeedback.value = true;
  setTimeout(() => {
    copyFeedback.value = false;
  }, 1500);
};

const clearSqlEditor = () => {
  sqlEditorContent.value = '';
  isSqlFormatted.value = false;
  rawSqlBeforeFormat.value = null;
  nextTick(() => {
    syncSqlEditorScroll();
    sqlTextareaRef.value?.focus();
  });
};

watch(activeSubTab, (sub) => {
  if (sub === 'sql') {
    nextTick(() => {
      syncSqlEditorScroll();
      sqlTextareaRef.value?.focus();
    });
  }
});

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
  <div class="sql-helper-container" :class="[`theme-${props.theme || globalTheme}`, { 'theme-95': (props.theme || globalTheme) === '95' }]">
    <!-- Top Bar with Sub-Tab Switcher -->
    <div class="control-bar glass">
      <div class="left-controls">
        <div class="subtab-switcher">
          <button 
            class="subtab-btn" 
            :class="{ active: activeSubTab === 'log' }" 
            @click="activeSubTab = 'log'"
          >
            <span v-html="Icons.FileText" class="subtab-icon"></span>
            Log
          </button>
          <button 
            class="subtab-btn" 
            :class="{ active: activeSubTab === 'sql' }" 
            @click="activeSubTab = 'sql'"
          >
            <span v-html="Icons.Edit" class="subtab-icon"></span>
            SQL Editor
          </button>
        </div>

        <div v-if="activeSubTab === 'log'" class="file-picker-group">
          <button @click="chooseFile" class="theme-button choose-btn">
            <span v-html="Icons.Folder" class="btn-icon"></span>
            Open Log
          </button>
          <span v-if="logPath" class="file-path-display" :title="logPath">{{ logPath.split(/[\\/]/).pop() }}</span>
        </div>
      </div>

      <!-- Right Actions for Log Sub-tab -->
      <div v-if="activeSubTab === 'log'" class="action-group">
        <button v-if="extractions.length > 0" @click="clearAllExtractions" class="theme-button clear-all-btn">
          <span v-html="Icons.Trash" class="btn-icon"></span>
          Clear All ({{ extractions.length }})
        </button>
      </div>

      <!-- Right Actions for SQL Editor Sub-tab -->
      <div v-else class="action-group">
        <button @click="handleFormatSqlEditor" class="theme-button choose-btn" title="Format SQL / Toggle Raw (Ctrl+Alt+F)">
          <svg class="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
          Format SQL
        </button>
        <button @click="pasteToSqlEditor" class="theme-button" title="Paste from Clipboard">
          <span v-html="Icons.Copy" class="btn-icon"></span>
          Paste
        </button>
        <button @click="copySqlEditorContent" class="theme-button" :disabled="!sqlEditorContent.trim()" title="Copy SQL">
          <span>{{ copyFeedback ? 'Copied!' : 'Copy' }}</span>
        </button>
        <button v-if="sqlEditorContent.trim()" @click="clearSqlEditor" class="theme-button clear-all-btn" title="Clear SQL">
          <span v-html="Icons.Trash" class="btn-icon"></span>
          Clear
        </button>
      </div>
    </div>

    <!-- Sub-Tab 1: Log Viewer & SQL Extractions -->
    <div v-show="activeSubTab === 'log'" class="sql-helper-split">
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

    <!-- Sub-Tab 2: Fast, Zero-Freeze Native SQL Editor & Formatter -->
    <div v-show="activeSubTab === 'sql'" class="sql-editor-pane">
      <div class="pane-header glass-header">
        <div class="header-left">
          <span class="pane-title">SQL EDITOR & FORMATTER</span>
          <span class="editor-hint">Paste raw SQL or Java StringBuilder SQL, then click Format SQL (Ctrl+Alt+F)</span>
        </div>
        <div class="header-right-meta">
          <span class="line-count-badge">{{ sqlEditorLineCount }} {{ sqlEditorLineCount === 1 ? 'line' : 'lines' }}</span>
        </div>
      </div>

      <div class="native-sql-editor-body">
        <!-- Line Number Gutter -->
        <div ref="sqlGutterRef" class="sql-editor-gutter" aria-hidden="true">
          <div v-for="n in sqlEditorLineCount" :key="n" class="gutter-line-num">{{ n }}</div>
        </div>

        <!-- Synchronized Highlighted Backdrop + Editable Textarea -->
        <div class="sql-editor-stage">
          <pre
            ref="sqlBackdropRef"
            class="sql-editor-backdrop"
            aria-hidden="true"
          ><code v-html="highlightedSqlEditorHtml + '\n'"></code></pre>

          <textarea
            ref="sqlTextareaRef"
            v-model="sqlEditorContent"
            class="sql-editor-textarea"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            placeholder="Paste or type your SQL query here (or Java StringBuilder.append SQL)...&#10;Press Format SQL (Ctrl+Alt+F) to clean and format."
            @scroll="syncSqlEditorScroll"
            @keydown="handleSqlEditorKeyDown"
          ></textarea>
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

.control-bar { padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 12px; }
.left-controls { display: flex; align-items: center; gap: 14px; }

.subtab-switcher {
  display: flex;
  padding: 3px;
  border-radius: 10px;
  gap: 4px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(128, 128, 128, 0.15);
}

.subtab-btn {
  border: none;
  background: transparent;
  color: var(--text-color);
  border-radius: 7px;
  cursor: pointer;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 800;
  transition: all 0.18s;
}

.subtab-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
}

.subtab-btn.active {
  opacity: 1;
  color: #ffffff;
  background: var(--accent-color, #6366f1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.subtab-icon {
  display: inline-flex;
  align-items: center;
  width: 14px;
  height: 14px;
}

.subtab-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.file-picker-group { display: flex; align-items: center; gap: 12px; }
.file-path-display { font-size: 0.75rem; opacity: 0.6; font-weight: 700; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-group { display: flex; align-items: center; gap: 8px; }

.btn-icon { margin-right: 6px; display: inline-flex; align-items: center; }

.sql-helper-split { display: flex; flex: 1; overflow: hidden; gap: 12px; }
.log-viewer-pane { flex: 1.2; display: flex; flex-direction: column; background: var(--container-bg); border-radius: 12px; border: 1px solid rgba(128, 128, 128, 0.1); overflow: hidden; }
.extraction-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* Sub-tab 2: Native SQL Editor Pane */
.sql-editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--container-bg);
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.15);
  overflow: hidden;
  min-height: 0;
}

.editor-hint {
  font-size: 0.72rem;
  opacity: 0.5;
  font-weight: 500;
}

.line-count-badge {
  font-size: 0.68rem;
  opacity: 0.55;
  font-family: 'Consolas', monospace;
  font-weight: 700;
}

.native-sql-editor-body {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  min-height: 0;
  background: rgba(0, 0, 0, 0.16);
}

.sql-editor-gutter {
  width: 48px;
  padding: 14px 8px 14px 4px;
  box-sizing: border-box;
  text-align: right;
  user-select: none;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.14);
  border-right: 1px solid rgba(128, 128, 128, 0.12);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--text-color);
  opacity: 0.4;
  flex-shrink: 0;
}

.gutter-line-num {
  height: 22.275px;
}

.sql-editor-stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.sql-editor-backdrop,
.sql-editor-textarea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 14px 16px;
  box-sizing: border-box;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 1.65;
  tab-size: 4;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow: auto;
  letter-spacing: normal;
}

.sql-editor-backdrop {
  pointer-events: none;
  color: var(--text-color);
  background: transparent;
  z-index: 1;
}

.sql-editor-backdrop code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  tab-size: inherit;
  white-space: inherit;
}

.sql-editor-textarea {
  z-index: 2;
  color: transparent;
  caret-color: var(--text-color);
  background: transparent;
  resize: none;
}

.sql-editor-textarea::placeholder {
  color: var(--text-color);
  opacity: 0.35;
}

.sql-editor-textarea::selection {
  background: rgba(99, 102, 241, 0.32);
  color: transparent;
}

/* 1:1 Character-Width Preserving Syntax Highlighting inside SQL Editor */
:deep(.sql-ed-kwd) {
  color: #569cd6;
}

:deep(.sql-ed-tbl) {
  color: #ff3344;
  background-color: rgba(255, 51, 68, 0.2);
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(255, 51, 68, 0.4);
}

:deep(.sql-ed-str) {
  color: #ce9178;
}

:deep(.sql-ed-cmt) {
  color: #6a9955;
}

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

.theme-button { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(128, 128, 128, 0.2); background: rgba(128, 128, 128, 0.1); color: var(--text-color); cursor: pointer; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; transition: all 0.2s; }
.theme-button:hover:not(:disabled) { background: rgba(128, 128, 128, 0.2); transform: translateY(-1px); }
.theme-button:disabled { opacity: 0.4; cursor: not-allowed; }

.choose-btn { background: var(--accent-color); color: white; border: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.choose-btn:hover:not(:disabled) { background: #6366f1; box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }

.clear-all-btn { color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); }
.clear-all-btn:hover:not(:disabled) { background: rgba(244, 63, 94, 0.1); }

/* Theme specific overrides */
.theme-light .glass { background: rgba(255, 255, 255, 0.7); border-color: rgba(0,0,0,0.1); }
.theme-light .log-viewer-pane, .theme-light .sql-editor-pane { background: #fff; }
.theme-light .native-sql-editor-body { background: #f8fafc; }
.theme-light .sql-editor-gutter { background: #f1f5f9; border-right-color: #e2e8f0; }
.theme-light .sql-output { background-color: #f1f5f9; color: #1e293b; border-color: #e2e8f0; }
.theme-light :deep(.sql-tbl),
.theme-light :deep(.sql-ed-tbl) {
  color: #dc2626 !important;
  background: rgba(220, 38, 38, 0.12) !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
  text-shadow: none !important;
}
.theme-light :deep(.sql-ed-kwd) {
  color: #0284c7;
}
.theme-light :deep(.sql-ed-str) {
  color: #b91c1c;
}

/* Windows 95 Theme Overrides */
.theme-95 .glass, .theme-95 .glass-header, .theme-95 .extraction-unit, .theme-95 .subtab-switcher { 
  background: #c0c0c0 !important; 
  border: 2px solid !important; 
  border-color: #fff #808080 #808080 #fff !important; 
  border-radius: 0 !important; 
  backdrop-filter: none !important; 
}
.theme-95 .theme-button, .theme-95 .mini-icon-btn, .theme-95 .format-btn, .theme-95 .copy-btn, .theme-95 .subtab-btn { 
  border: 2px solid !important; 
  border-color: #fff #808080 #808080 #fff !important; 
  border-radius: 0 !important; 
  background: #c0c0c0 !important; 
  color: #000 !important; 
  box-shadow: none !important;
}
.theme-95 .subtab-btn.active {
  background: #000080 !important;
  color: #ffffff !important;
  border-color: #808080 #fff #fff #808080 !important;
}
.theme-95 .log-viewer-pane,
.theme-95 .sql-editor-pane,
.theme-95 .sql-output {
  background: #ffffff !important;
  color: #000000 !important;
  border: 2px solid !important;
  border-color: #808080 #fff #fff #808080 !important;
  border-radius: 0 !important;
}
.theme-95 .native-sql-editor-body {
  background: #ffffff !important;
}
.theme-95 .sql-editor-gutter {
  background: #dfdfdf !important;
  color: #000000 !important;
  opacity: 1 !important;
  border-right: 1px solid #808080 !important;
}
.theme-95 :deep(.sql-kwd),
.theme-95 :deep(.sql-ed-kwd) {
  color: #0000aa !important;
}
.theme-95 :deep(.sql-str),
.theme-95 :deep(.sql-ed-str) {
  color: #7f0000 !important;
}
.theme-95 :deep(.sql-ed-tbl) {
  color: #cc0000 !important;
  background: #ffe5e5 !important;
  box-shadow: 0 0 0 1px #cc0000 !important;
  border-radius: 0 !important;
}
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
