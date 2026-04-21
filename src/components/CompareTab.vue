<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { sharedInput, sharedOutput, theme as globalTheme } from '../store';



// The two sides of the diff
const originalText = ref(sharedInput.value);
const modifiedText = ref(sharedOutput.value);
const diffEditorRef = ref<any>(null);
import { activeTab } from '../store';


const normalize = (val: string) => val ? val.replace(/\r\n/g, '\n') : '';

// Sync with shared store (from store to local)
watch(sharedInput, (val) => {
  const normVal = normalize(val);
  if (normalize(originalText.value) !== normVal) originalText.value = normVal;
});
watch(sharedOutput, (val) => {
  if (activeTab.value !== 'Compare') return;
  const normVal = normalize(val);
  if (normalize(modifiedText.value) !== normVal) modifiedText.value = normVal;
});

// Sync local changes back to store (two-way)
watch(originalText, (val) => {
  const normVal = normalize(val);
  if (normalize(sharedInput.value) !== normVal) sharedInput.value = normVal;
});
watch(modifiedText, (val) => {
  const normVal = normalize(val);
  if (normalize(sharedOutput.value) !== normVal) sharedOutput.value = normVal;
});

const handleEditorMount = (editor: any, _monaco: any) => {
  diffEditorRef.value = editor;
  
  const original = editor.getOriginalEditor();
  const modified = editor.getModifiedEditor();

  // Robust synchronization from Monaco directly back to our refs
  original.onDidChangeModelContent(() => {
    const val = normalize(original.getValue());
    if (normalize(originalText.value) !== val) originalText.value = val;
  });

  modified.onDidChangeModelContent(() => {
    const val = normalize(modified.getValue());
    if (normalize(modifiedText.value) !== val) modifiedText.value = val;
  });
};


// Monaco instance for theme definition

const monacoRef = ref<any>(null);

const handleEditorBeforeMount = (monaco: any) => {
  monacoRef.value = monaco;
  
  // Define custom themes that match our app's CSS variables
  monaco.editor.defineTheme('app-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#161b22', // Matches var(--container-bg) in dark
    }
  });

  monaco.editor.defineTheme('app-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff', // Matches var(--container-bg) in light
    }
  });
};

// Monaco Diff Editor options
const DIFF_OPTIONS = computed(() => ({
  automaticLayout: true,
  fontSize: 13,
  fontFamily: "'Consolas', 'Courier New', monospace",
  lineNumbers: 'on' as const,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  renderSideBySide: true,
  originalEditable: true, 
  readOnly: false,
  domReadOnly: false,
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
    useShadows: false,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  theme: globalTheme.value === 'dark' ? 'app-dark' : 'app-light'
}));

const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });


const swapInputs = () => {
  console.log('Swapping Compare inputs...');
  const temp = originalText.value;
  originalText.value = modifiedText.value;
  modifiedText.value = temp;
};

const clearInputs = () => {
  console.log('Clearing Compare inputs...');
  originalText.value = '';
  modifiedText.value = '';
};

const sortIdenticalToTop = () => {
  if (!originalText.value && !modifiedText.value) return;
  
  const lines1 = originalText.value.split(/\r?\n/);
  const lines2 = modifiedText.value.split(/\r?\n/);
  
  const common: string[] = [];
  const only1: string[] = [];
  const only2: string[] = [];
  
  // Frequency map for lines2
  const freq2 = new Map<string, number>();
  lines2.forEach(l => freq2.set(l, (freq2.get(l) || 0) + 1));
  
  // Identify common lines in order of original text
  lines1.forEach(l => {
    const count = freq2.get(l) || 0;
    if (count > 0) {
      common.push(l);
      freq2.set(l, count - 1);
    } else {
      only1.push(l);
    }
  });
  
  // What is left in freq2 is only in lines2
  // We need to maintain some order for only2. Re-scan lines2.
  const freq1_copy = new Map<string, number>();
  lines1.forEach(l => freq1_copy.set(l, (freq1_copy.get(l) || 0) + 1));
  
  lines2.forEach(l => {
    const count = freq1_copy.get(l) || 0;
    if (count > 0) {
      freq1_copy.set(l, count - 1);
    } else {
      only2.push(l);
    }
  });
  
  originalText.value = [...common, ...only1].join('\n');
  modifiedText.value = [...common, ...only2].join('\n');
};

// Internal watcher for debugging (optional, normally silents)
watch([originalText, modifiedText], () => {
  // Silent or throttled logging
}, { deep: true });

const renderSideBySide = ref(true);
const currentOptions = computed(() => ({
  ...DIFF_OPTIONS.value,
  renderSideBySide: renderSideBySide.value,
}));
</script>

<template>
  <div class="compare-container">
    <header class="action-bar glass">
      <div class="toolbar-section">
        <span class="toolbar-title">CODE COMPARE</span>
      </div>

      <div class="toolbar-section">
        <div class="button-group glass">
          <button class="icon-btn" :class="{ active: !renderSideBySide }" @click="renderSideBySide = !renderSideBySide" title="Toggle Inline/Split View">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2h14v12H1V2zm6.5 1.5v9h1v-9h-1zM2.5 3.5v9h4v-9h-4zm7 0v9h4v-9h-4z"/>
            </svg>
          </button>
          <button class="icon-btn" @click="swapInputs" title="Swap Sides">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1l3 3-3 3V5H2V3h9V1zm-6 8l-3 3 3 3v-2h9v-2H5v-2z"/>
            </svg>
          </button>
          <button class="icon-btn" @click="sortIdenticalToTop" title="Sort Identical to Top">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1L4 5h3v4h2V5h3L8 1zM2 11h12v2H2v-2zm2 3h8v1H4v-1z"/>
            </svg>
          </button>
          <button class="icon-btn" @click="clearInputs" title="Clear All Texts">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.5 3.5l1-1h7l1 1h2v1H1.5v-1h2zM3 5h10v9h-1V5H4v9H3V5zm7 1v6H9V6h1zm-3 0v6H6V6h1z"/>
            </svg>
          </button>
        </div>
        
        <div class="divider"></div>
      </div>
    </header>

    <main class="main-content">
      <div class="editor-wrapper glass">
        <VueMonacoDiffEditor
          :original="originalText"
          :modified="modifiedText"
          :theme="globalTheme === 'dark' ? 'app-dark' : 'app-light'"
          language="plaintext"
          :options="currentOptions"
          @before-mount="handleEditorBeforeMount"
          @mount="handleEditorMount"
          class="diff-instance"
        />
      </div>
    </main>

    <transition name="bubble">
      <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">
        Copied!
      </div>
    </transition>
  </div>
</template>

<style scoped>
.compare-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 15px;
  background: var(--container-bg);
  gap: 12px;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--text-color);
}

.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
}

/* Action Bar */
.action-bar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-radius: 12px;
  flex-shrink: 0;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  opacity: 0.8;
  color: var(--accent-color);
  padding-left: 5px;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
}

.status-summary {
  display: flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.no-diff-text {
  font-size: 0.65rem;
  opacity: 0.4;
  font-weight: 500;
}

.button-group {
  display: flex;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-color);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

.icon-btn.active {
  opacity: 1;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
}

/* Main Layout */
.main-content {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  min-width: 0;
}

/* Theme specific overrides for glass and sidebar */
.compare-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 15px;
  box-sizing: border-box;
  --glass-bg: rgba(30, 30, 30, 0.4);
  --glass-border: rgba(255, 255, 255, 0.05);
  --sidebar-header-bg: rgba(255, 255, 255, 0.05);
  background: var(--bg-color);
  overflow: hidden;
}

:root.theme-light .compare-container {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.1);
  --sidebar-header-bg: rgba(0, 0, 0, 0.05);
  --container-bg: #f8fafc;
  --bg-color: #f8fafc;
}

.diff-instance {
  width: 100%;
  height: 100%;
}

/* Custom Scrollbar for Sidebar (removed, but keeping general scrollbar if needed elsewhere) */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
</style>
