<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VueMonacoEditor, VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { theme as globalTheme } from '../store';
import { Icons } from '../utils/icons';
import { useConvert } from '../composables/useConvert';

// --- Composable ---
const {
  inputText,
  resultText,
  isProcessing,
  showDiff,
  convertMode,
  selectedEncoding,
  lastOpenedPath,
  status,
  clearAll,
  copyResult,
  handleConvert,
  reopenWithEncoding
} = useConvert();

// --- State ---
const leftEditorRef = ref<any>(null);
const rightEditorRef = ref<any>(null);
const diffEditorRef = ref<any>(null);

// --- Monaco Options ---
const editorOptions = computed(() => ({
  fontSize: 13,
  minimap: { enabled: false },
  wordWrap: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  theme: globalTheme.value === 'dark' ? 'vs-dark' : 'vs',
  lineNumbers: 'on' as const,
  readOnly: false,
  tabSize: 4,
  insertSpaces: false,
  detectIndentation: false,
  padding: { top: 10, bottom: 10 },
  scrollbar: {
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
  },
}));

const handleLeftMount = (editor: any) => { leftEditorRef.value = editor; };
const handleRightMount = (editor: any) => { rightEditorRef.value = editor; };
const handleDiffMount = (editor: any) => { diffEditorRef.value = editor; };

watch(showDiff, () => nextTick(() => {
  // Logic to refresh editors if needed
}));

watch(selectedEncoding, () => {
  if (lastOpenedPath.value) reopenWithEncoding();
});

defineExpose({
  clearAll,
  copyResult,
  handleConvert
});
</script>

<template>
  <div class="convert-root" :class="{ 'win95-bg': globalTheme === '95' }">
    <header class="main-toolbar glass">
      <div class="t-left">
        <span class="t-brand">CONVERT UI</span>
        <div class="t-controls">
          <div class="control-group">
            <span class="c-label">MODE</span>
            <select v-model="convertMode" class="c-select">
              <option value="PDA">PDA JSP</option>
              <option value="Common">Common</option>
            </select>
          </div>
          <div class="control-group">
            <span class="c-label">ENCODING</span>
            <select v-model="selectedEncoding" class="c-select">
              <option value="Shift_JIS">Shift_JIS (JP)</option>
              <option value="UTF-8">UTF-8</option>
              <option value="EUC-JP">EUC-JP (JP)</option>
              <option value="Windows-31J">MS932</option>
            </select>
          </div>
        </div>
      </div>
      <div class="t-right">
        <button class="t-btn-icon danger" @click="clearAll" title="Clear All" v-html="Icons.Trash2"></button>
        <div class="t-divider"></div>
        <button class="t-btn-text" @click="showDiff = !showDiff" :class="{ active: showDiff }">
          <span v-html="showDiff ? Icons.Cpu : Icons.RefreshCw" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
          {{ showDiff ? 'View Result' : 'Comparison' }}
        </button>
        <button class="t-btn-text" @click="copyResult" :disabled="!resultText">
          <span v-html="Icons.Copy" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
          Copy
        </button>
        <button class="t-btn-primary" @click="handleConvert" :disabled="isProcessing">
          <span v-if="!isProcessing">
            <span v-html="Icons.Cpu" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span>
            Convert
          </span>
          <span v-else class="t-loader"></span>
        </button>
      </div>
    </header>

    <div class="status-tip" v-if="status.msg" :class="status.type">
      <span v-if="status.type === 'success'" v-html="Icons.Check" style="display:inline-block; margin-right:6px;"></span>
      {{ status.msg }}
    </div>

    <main class="workspace" :class="{ 'is-unified': showDiff }">
      <template v-if="!showDiff">
        <div class="w-pane">
          <div class="w-header"><span class="w-label">SOURCE (INPUT)</span></div>
          <div class="w-editor">
            <VueMonacoEditor
              v-model:value="inputText"
              language="html"
              :options="editorOptions"
              @mount="handleLeftMount"
            />
          </div>
        </div>
        <div class="w-pane">
          <div class="w-header"><span class="w-label">RESULT (OUTPUT)</span></div>
          <div class="w-editor">
            <VueMonacoEditor
              v-model:value="resultText"
              language="html"
              :options="editorOptions"
              @mount="handleRightMount"
            />
          </div>
        </div>
      </template>
      <div v-else class="w-pane full-width">
        <div class="w-header"><span class="w-label">COMPARISON: SOURCE VS CONVERTED</span></div>
        <div class="w-editor">
          <VueMonacoDiffEditor
            :original="inputText"
            :modified="resultText"
            language="html"
            :options="editorOptions"
            @mount="handleDiffMount"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.convert-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 12px;
  box-sizing: border-box;
  background: var(--container-bg);
  color: var(--text-color);
}
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.main-toolbar {
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-radius: 12px;
  flex-shrink: 0;
}
.t-left { display: flex; align-items: center; gap: 24px; }
.t-brand { font-weight: 900; font-size: 0.8rem; letter-spacing: 0.15em; color: var(--accent-color); }
.t-controls { display: flex; align-items: center; gap: 16px; }
.control-group { display: flex; align-items: center; gap: 8px; }
.c-label { font-size: 0.6rem; font-weight: 800; opacity: 0.4; letter-spacing: 0.05em; }
.c-select {
  background: rgba(0,0,0,0.06);
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}
.c-select:focus { border-color: var(--accent-color); }

.t-right { display: flex; align-items: center; gap: 10px; }
.t-divider { width: 1px; height: 20px; background: var(--glass-border); margin: 0 4px; }

.t-btn-icon {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  width: 32px; height: 32px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.t-btn-icon.danger:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: #ef4444; }

.t-btn-text {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-color);
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center;
  transition: all 0.2s;
}
.t-btn-text:disabled { opacity: 0.4; cursor: not-allowed; }
.t-btn-text:hover:not(:disabled) { border-color: var(--accent-color); background: rgba(99, 102, 241, 0.05); }
.t-btn-text.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }

.t-btn-primary {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 6px 18px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  height: 32px;
  display: flex; align-items: center; gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}
.t-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3); }
.t-btn-primary:active:not(:disabled) { transform: translateY(0); }
.t-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.status-tip {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  display: flex; align-items: center;
  animation: slideDown 0.3s ease-out;
}
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.status-tip.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
.status-tip.warn    { background: rgba(234, 179, 8, 0.1);  color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); }
.status-tip.error   { background: rgba(239, 68, 68, 0.1);  color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }

.workspace { flex: 1; display: flex; gap: 12px; min-height: 0; }
.workspace.is-unified { flex-direction: column; }
.w-pane {
  flex: 1; display: flex; flex-direction: column;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.3s ease;
}
.w-pane:hover { border-color: var(--accent-color); box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
.w-pane.full-width { flex: none; height: 100%; }

.w-header {
  height: 36px; display: flex; align-items: center;
  padding: 0 14px;
  background: rgba(0,0,0,0.02);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}
.w-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.4; }
.w-editor { flex: 1; min-height: 0; }

.t-loader {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,.3);
  border-radius: 50%; border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.win95-bg .glass {
  background: #c0c0c0 !important;
  border: 2px solid !important;
  border-color: #ffffff #808080 #808080 #ffffff !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}
.win95-bg .t-btn-primary {
    border: 2px solid !important;
  border-color: #ffffff #808080 #808080 #ffffff !important;
  background: #c0c0c0 !important;
  color: #000 !important;
  border-radius: 0 !important;
}
</style>
