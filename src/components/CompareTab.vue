<script setup lang="ts">
import { ref, computed } from 'vue';
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor';
import { useCompare } from '../composables/useCompare';
import { theme as globalTheme } from '../store';
import { Icons } from '../utils/icons';

const props = defineProps<{ theme?: string }>();

const {
  originalText,
  modifiedText,
  handleEditorMount,
  swapInputs,
  clearInputs,
  sortIdenticalToTop,
} = useCompare();

const handleEditorBeforeMount = (monaco: any) => {
  
  monaco.editor.defineTheme('app-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
    }
  });

  monaco.editor.defineTheme('app-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
    }
  });
};

const renderSideBySide = ref(true);

const currentOptions = computed(() => ({
  automaticLayout: true,
  fontSize: 13,
  fontFamily: "'Consolas', 'Courier New', monospace",
  lineNumbers: 'on' as const,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  renderSideBySide: renderSideBySide.value,
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
</script>

<template>
  <div class="compare-tab" :class="{ 'win95': props.theme === '95' }">
    <header class="action-bar glass">
      <div class="toolbar-section">
        <span class="toolbar-title">COMPARE</span>
      </div>

      <div class="toolbar-section">
        <div class="button-group glass">
          <button class="icon-btn" :class="{ active: !renderSideBySide }" @click="renderSideBySide = !renderSideBySide" title="Toggle Inline/Split View">
            <span v-html="renderSideBySide ? Icons.Columns : Icons.Rows"></span>
          </button>
          <button class="icon-btn" @click="swapInputs" title="Swap Sides">
            <span v-html="Icons.RefreshCw"></span>
          </button>
          <button class="icon-btn" @click="sortIdenticalToTop" title="Sort Identical to Top">
            <span v-html="Icons.ArrowUpCircle"></span>
          </button>
          <button class="icon-btn danger" @click="clearInputs" title="Clear All Texts">
            <span v-html="Icons.Trash2"></span>
          </button>
        </div>
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
  </div>
</template>

<style scoped>
.compare-tab { display: flex; flex-direction: column; height: 100%; padding: 12px; background: var(--container-bg); gap: 12px; box-sizing: border-box; overflow: hidden; }
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
}
.action-bar { height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-radius: 12px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.toolbar-section { display: flex; align-items: center; gap: 12px; }
.toolbar-title { font-size: 0.8rem; font-weight: 900; letter-spacing: 0.1em; color: var(--accent-color); opacity: 0.8; }

.button-group { display: flex; padding: 4px; border-radius: 10px; gap: 4px; background: rgba(0,0,0,0.05); }
.icon-btn { width: 32px; height: 32px; border: none; background: transparent; color: var(--text-color); border-radius: 8px; cursor: pointer; opacity: 0.5; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); transform: translateY(-1px); }
.icon-btn.active { opacity: 1; color: var(--accent-color); background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.icon-btn.danger:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.main-content { flex: 1; display: flex; min-height: 0; }
.editor-wrapper { flex: 1; border-radius: 16px; overflow: hidden; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
.diff-instance { width: 100%; height: 100%; }

.win95 .action-bar { background: #c0c0c0; border: 2px outset #fff; border-radius: 0; box-shadow: none; }
.win95 .icon-btn { border: 2px outset #fff; border-radius: 0; background: #c0c0c0; }
.win95 .icon-btn.active { border: 2px inset #fff; background: #d0d0d0; }
.win95 .editor-wrapper { border: 2px inset #fff; border-radius: 0; }
</style>
