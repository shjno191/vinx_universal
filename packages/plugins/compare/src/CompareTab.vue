<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as monaco from 'monaco-editor';
import { VueMonacoDiffEditor, loader } from '@guolao/vue-monaco-editor';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCompare } from './useCompare';
import { 
  theme as globalTheme, 
  editorSettings, 
  Icons, 
  useFileSystem, 
  activeTab 
} from '@vinx/sdk';
import ImageCompare from './ImageCompare.vue';
import { 
  validateDroppedFile, 
  isBinaryContent 
} from './file-validator';

// Unify Monaco instance
loader.config({ monaco });

const props = defineProps<{ theme?: string; isActive?: boolean; active?: boolean }>();
const compareContainerRef = ref<HTMLElement | null>(null);

const isTabActive = () => {
  if (props.isActive !== undefined) return props.isActive;
  if (props.active !== undefined) return props.active;
  if (compareContainerRef.value) {
    if (typeof compareContainerRef.value.checkVisibility === 'function') {
      return compareContainerRef.value.checkVisibility();
    }
    return compareContainerRef.value.offsetWidth > 0 || compareContainerRef.value.offsetHeight > 0 || compareContainerRef.value.offsetParent !== null;
  }
  return true;
};

const activeMode = ref<'text' | 'image'>('text');

const {
  originalText,
  modifiedText,
  diffEditorRef,
  handleEditorMount,
  swapInputs,
  clearInputs,
  sortIdenticalToTop,
} = useCompare();

const { readFile } = useFileSystem();

const monacoInstance = ref<any>(null);

const registerBoiScriptAndTheme = (monacoRef: any) => {
  if (!monacoRef) return;

  if (!monacoRef.languages.getLanguages().some((lang: any) => lang.id === 'boi-script')) {
    monacoRef.languages.register({ id: 'boi-script' });
  }

  monacoRef.languages.setMonarchTokensProvider('boi-script', {
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\bfunction\b/, 'keyword'],
        [/\b[a-zA-Z_]\w*(?=\s*\()/, 'function'],
        [/[$\#][a-zA-Z_]\w*/, 'variable'],
        [/\b(if|endif|while|endwhile|return|else)\b/, 'keyword'],
        [/\b\d+\b/, 'number'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });

  const fnColor = (editorSettings.value?.colors?.function || '#e27a00').replace('#', '');
  const varColor = (editorSettings.value?.colors?.variable || '#2a2a2a').replace('#', '');
  const commentColor = (editorSettings.value?.colors?.comment || '#3F7F5F').replace('#', '');
  const keywordColor = (editorSettings.value?.colors?.keyword || '#000080').replace('#', '');

  monacoRef.editor.defineTheme('vinx-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: {},
    rules: [
      { token: 'function', foreground: fnColor },
      { token: 'entity.name.function', foreground: fnColor },
      { token: 'variable', foreground: varColor },
      { token: 'comment', foreground: commentColor },
      { token: 'keyword', foreground: keywordColor, fontStyle: 'bold' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'string', foreground: 'CE9178' },
    ],
  });

  monacoRef.editor.defineTheme('vinx-light', {
    base: 'vs',
    inherit: true,
    colors: {},
    rules: [
      { token: 'function', foreground: fnColor },
      { token: 'entity.name.function', foreground: fnColor },
      { token: 'variable', foreground: varColor },
      { token: 'comment', foreground: commentColor },
      { token: 'keyword', foreground: keywordColor, fontStyle: 'bold' },
      { token: 'number', foreground: '000000' },
      { token: 'string', foreground: 'bb5352' },
    ],
  });
};

const handleEditorBeforeMount = (inst: any) => {
  monacoInstance.value = inst;
  registerBoiScriptAndTheme(inst);
};

const activeCompareTheme = computed(() => {
  const current = props.theme || globalTheme.value;
  return current === 'dark' ? 'vinx-dark' : 'vinx-light';
});

const syncTheme = () => {
  if (monacoInstance.value) {
    registerBoiScriptAndTheme(monacoInstance.value);
    monacoInstance.value.editor.setTheme(activeCompareTheme.value);
  }
};

watch(() => editorSettings.value?.colors, () => {
  syncTheme();
}, { deep: true });

watch(() => props.theme, () => {
  syncTheme();
});

watch(globalTheme, () => {
  syncTheme();
});

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
  theme: activeCompareTheme.value,
}));

// --- Drag & Drop State & Handlers ---rs ---
const editorWrapperRef = ref<HTMLElement | null>(null);
const imageCompareRef = ref<any>(null);
const isDraggingFile = ref(false);
const dragTargetSide = ref<'original' | 'modified'>('original');
const dragCounter = ref(0);
let unlistenDropHandler: (() => void) | null = null;

// --- Toast Feedback ---
const toast = ref<{ message: string; type: 'info' | 'success' | 'warn' | 'error' } | null>(null);
let toastTimer: any = null;

const showToast = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { message, type };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 4000);
};

const getImageUrl = (fileOrPath: any): string => {
  if (typeof fileOrPath === 'string') {
    try {
      return convertFileSrc(fileOrPath);
    } catch (_) {
      return fileOrPath;
    }
  }
  if (fileOrPath instanceof Blob || fileOrPath instanceof File) {
    return URL.createObjectURL(fileOrPath);
  }
  if (fileOrPath?.path) {
    try {
      return convertFileSrc(fileOrPath.path);
    } catch (_) {}
  }
  return '';
};

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  dragCounter.value++;
  isDraggingFile.value = true;
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  if (editorWrapperRef.value) {
    const rect = editorWrapperRef.value.getBoundingClientRect();
    const isLeft = (e.clientX - rect.left) < (rect.width / 2);
    dragTargetSide.value = isLeft ? 'original' : 'modified';
  }
  isDraggingFile.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  dragCounter.value--;
  if (dragCounter.value <= 0) {
    dragCounter.value = 0;
    isDraggingFile.value = false;
  }
};

const readFileOrText = async (file: any): Promise<{ content: string; name: string; path?: string }> => {
  const name = file.name || file.path?.split(/[/\\]/).pop() || 'file';
  const path = file.path || '';
  if (path) {
    try {
      const content = await readFile(path);
      return { content, name, path };
    } catch (_) {}
  }
  if (typeof file.text === 'function') {
    const content = await file.text();
    return { content, name, path };
  }
  return { content: '', name, path };
};

// Process HTML5 dropped files
const handleHtml5Drop = async (fileList?: FileList | null, specificSide?: 'original' | 'modified') => {
  dragCounter.value = 0;
  isDraggingFile.value = false;
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);

  // 1. Extension & type validation
  const validations = files.map(f => {
    return {
      file: f,
      fileName: f.name,
      ...validateDroppedFile(f.name, f.type)
    };
  });

  // Check if any invalid file (Excel, Binary, etc.)
  const invalidFiles = validations.filter(v => !v.valid);
  if (invalidFiles.length > 0) {
    showToast(invalidFiles[0].errorMessage || `Unsupported file: ${invalidFiles[0].fileName}`, 'error');
    return;
  }

  // Check if image file(s)
  const imageFiles = validations.filter(v => v.category === 'image');
  if (imageFiles.length > 0) {
    activeMode.value = 'image';
    const urls = imageFiles.map(img => getImageUrl(img.file));
    await nextTick();
    imageCompareRef.value?.loadDroppedImages(urls);
    showToast(`Detected image file(s). Switched to Image Compare.`, 'info');
    return;
  }

  // Text/Code files
  if (files.length >= 2) {
    try {
      const res1 = await readFileOrText(files[0]);
      const res2 = await readFileOrText(files[1]);

      if (isBinaryContent(res1.content)) {
        showToast(`File "${files[0].name}" contains binary data and cannot be compared.`, 'error');
        return;
      }
      if (isBinaryContent(res2.content)) {
        showToast(`File "${files[1].name}" contains binary data and cannot be compared.`, 'error');
        return;
      }

      originalText.value = res1.content;
      modifiedText.value = res2.content;
      showToast(`Loaded "${files[0].name}" (Left) and "${files[1].name}" (Right)`, 'success');
    } catch (err: any) {
      showToast(`Failed to read files: ${err?.message || err}`, 'error');
    }
  } else {
    try {
      const res = await readFileOrText(files[0]);
      if (isBinaryContent(res.content)) {
        showToast(`File "${files[0].name}" contains binary data and cannot be compared.`, 'error');
        return;
      }

      const side = specificSide || dragTargetSide.value;
      if (side === 'original') {
        originalText.value = res.content;
        showToast(`Loaded "${files[0].name}" into Original (Left)`, 'success');
      } else {
        modifiedText.value = res.content;
        showToast(`Loaded "${files[0].name}" into Modified (Right)`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to read file: ${err?.message || err}`, 'error');
    }
  }
};

const handleDropSpecific = (side: 'original' | 'modified', e: DragEvent) => {
  handleHtml5Drop(e.dataTransfer?.files, side);
};

const handleDrop = (e: DragEvent) => {
  handleHtml5Drop(e.dataTransfer?.files);
};

// Process Tauri native dropped paths
const handleTauriDrop = async (paths: string[], clientX?: number) => {
  if (!paths || paths.length === 0) return;

  const validations = paths.map(p => {
    const fileName = p.split(/[/\\]/).pop() || p;
    return { path: p, fileName, ...validateDroppedFile(fileName) };
  });

  const invalidFiles = validations.filter(v => !v.valid);
  if (invalidFiles.length > 0) {
    showToast(invalidFiles[0].errorMessage || `Unsupported file: ${invalidFiles[0].fileName}`, 'error');
    return;
  }

  const imageFiles = validations.filter(v => v.category === 'image');
  if (imageFiles.length > 0) {
    activeMode.value = 'image';
    const urls = imageFiles.map(img => getImageUrl(img.path));
    await nextTick();
    imageCompareRef.value?.loadDroppedImages(urls);
    showToast(`Detected image file(s). Switched to Image Compare.`, 'info');
    return;
  }

  if (paths.length >= 2) {
    try {
      const text1 = await readFile(paths[0]);
      const text2 = await readFile(paths[1]);

      if (isBinaryContent(text1)) {
        showToast(`File "${validations[0].fileName}" contains binary data and cannot be compared.`, 'error');
        return;
      }
      if (isBinaryContent(text2)) {
        showToast(`File "${validations[1].fileName}" contains binary data and cannot be compared.`, 'error');
        return;
      }

      originalText.value = text1;
      modifiedText.value = text2;
      showToast(`Loaded "${validations[0].fileName}" (Left) and "${validations[1].fileName}" (Right)`, 'success');
    } catch (err: any) {
      showToast(`Failed to read files: ${err?.message || err}`, 'error');
    }
  } else {
    try {
      const text = await readFile(paths[0]);
      if (isBinaryContent(text)) {
        showToast(`File "${validations[0].fileName}" contains binary data and cannot be compared.`, 'error');
        return;
      }

      let side = dragTargetSide.value;
      if (clientX !== undefined && editorWrapperRef.value) {
        const rect = editorWrapperRef.value.getBoundingClientRect();
        side = (clientX - rect.left) < (rect.width / 2) ? 'original' : 'modified';
      }

      if (side === 'original') {
        originalText.value = text;
        showToast(`Loaded "${validations[0].fileName}" into Original (Left)`, 'success');
      } else {
        modifiedText.value = text;
        showToast(`Loaded "${validations[0].fileName}" into Modified (Right)`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to read file: ${err?.message || err}`, 'error');
    }
  }
};

onMounted(async () => {
  // Listen for Tauri native file drag & drop events
  try {
    const appWindow = getCurrentWebviewWindow();
    const unlisten = await appWindow.onDragDropEvent(async (event) => {
      if (!isTabActive()) return;

      if (event.payload.type === 'over' || event.payload.type === 'enter') {
        isDraggingFile.value = true;
        const pos = event.payload.position;
        if (pos && editorWrapperRef.value) {
          const dpr = window.devicePixelRatio || 1;
          const clientX = pos.x / dpr;
          const rect = editorWrapperRef.value.getBoundingClientRect();
          const isLeft = (clientX - rect.left) < (rect.width / 2);
          dragTargetSide.value = isLeft ? 'original' : 'modified';
        }
      } else if (event.payload.type === 'leave') {
        isDraggingFile.value = false;
        dragCounter.value = 0;
      } else if (event.payload.type === 'drop') {
        isDraggingFile.value = false;
        dragCounter.value = 0;
        const paths = event.payload.paths;
        const pos = event.payload.position;
        const dpr = window.devicePixelRatio || 1;
        const clientX = pos ? pos.x / dpr : undefined;
        await handleTauriDrop(paths, clientX);
      }
    });
    unlistenDropHandler = unlisten;
  } catch (err) {
    console.warn('[CompareTab] Tauri drag drop listener not available:', err);
  }
});

onUnmounted(() => {
  if (unlistenDropHandler) unlistenDropHandler();
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<template>
  <div 
    ref="compareContainerRef"
    class="compare-tab" 
    :class="{ 'win95': props.theme === '95' }"
    @dragover.prevent="handleDragOver"
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <header class="action-bar glass">
      <div class="toolbar-section">
        <span class="toolbar-title">COMPARE</span>
        <div class="mode-switcher glass">
          <button class="mode-btn" :class="{ active: activeMode === 'text' }" @click="activeMode = 'text'">
            <span v-html="Icons.FileText"></span> Text
          </button>
          <button class="mode-btn" :class="{ active: activeMode === 'image' }" @click="activeMode = 'image'">
            <span v-html="Icons.Image"></span> Image
          </button>
        </div>
      </div>

      <div class="toolbar-section" v-if="activeMode === 'text'">
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
      <div 
        v-if="activeMode === 'text'" 
        ref="editorWrapperRef"
        class="editor-wrapper glass"
      >
        <VueMonacoDiffEditor
          :original="originalText"
          :modified="modifiedText"
          :theme="activeCompareTheme"
          language="boi-script"
          :options="currentOptions"
          @before-mount="handleEditorBeforeMount"
          @mount="handleEditorMount"
          class="diff-instance"
        />

        <!-- Visual Drag & Drop Overlay -->
        <div v-if="isDraggingFile" class="drop-overlay">
          <div 
            class="drop-zone left-zone" 
            :class="{ active: dragTargetSide === 'original' }"
            @dragover.prevent="dragTargetSide = 'original'"
            @drop.stop.prevent="handleDropSpecific('original', $event)"
          >
            <div class="drop-indicator">
              <span class="drop-icon" v-html="Icons.FileText"></span>
              <span class="drop-label">Drop file for Original (Left)</span>
              <span class="drop-hint">Text / code file, or drop image to switch mode</span>
            </div>
          </div>
          <div 
            class="drop-zone right-zone" 
            :class="{ active: dragTargetSide === 'modified' }"
            @dragover.prevent="dragTargetSide = 'modified'"
            @drop.stop.prevent="handleDropSpecific('modified', $event)"
          >
            <div class="drop-indicator">
              <span class="drop-icon" v-html="Icons.FileText"></span>
              <span class="drop-label">Drop file for Modified (Right)</span>
              <span class="drop-hint">Text / code file, or drop image to switch mode</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="image-wrapper glass">
        <ImageCompare ref="imageCompareRef" />
      </div>
    </main>


    <!-- Compare Toast Notification -->
    <Teleport to="body">
      <transition name="toast-fade">
        <div v-if="toast" class="compare-toast glass" :class="[toast.type, { 'win95-toast': props.theme === '95' }]">
          <span class="toast-icon">
            <span v-if="toast.type === 'error' || toast.type === 'warn'">⚠️</span>
            <span v-else-if="toast.type === 'success'">✅</span>
            <span v-else>ℹ️</span>
          </span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      </transition>
    </Teleport>
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

.mode-switcher { display: flex; padding: 4px; border-radius: 10px; gap: 4px; background: rgba(0,0,0,0.05); }
.mode-btn { border: none; background: transparent; color: var(--text-color); border-radius: 8px; cursor: pointer; opacity: 0.5; display: flex; align-items: center; justify-content: center; padding: 4px 12px; font-weight: bold; gap: 6px; font-size: 0.85rem; transition: all 0.2s; }
.mode-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }
.mode-btn.active { opacity: 1; color: var(--accent-color); background: var(--glass-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

.button-group { display: flex; padding: 4px; border-radius: 10px; gap: 4px; background: rgba(0,0,0,0.05); }
.icon-btn { width: 32px; height: 32px; border: none; background: transparent; color: var(--text-color); border-radius: 8px; cursor: pointer; opacity: 0.5; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); transform: translateY(-1px); }
.icon-btn.active { opacity: 1; color: var(--accent-color); background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.icon-btn.danger:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.main-content { flex: 1; display: flex; min-height: 0; }
.editor-wrapper { flex: 1; border-radius: 16px; overflow: hidden; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.1); background: var(--container-bg); border: var(--border-style); }
.diff-instance { width: 100%; height: 100%; }
.image-wrapper { flex: 1; border-radius: 16px; overflow: hidden; position: relative; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; }

/* Visual Drop Overlay */
.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 100;
  pointer-events: none;
  animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.drop-zone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: copy;
  pointer-events: auto;
}
.drop-zone.active {
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.22);
  transform: scale(0.99);
  box-shadow: inset 0 0 24px rgba(99, 102, 241, 0.2);
}
.drop-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-color);
  opacity: 0.75;
  text-align: center;
  pointer-events: none;
}
.drop-zone.active .drop-indicator {
  opacity: 1;
  color: #fff;
}
.drop-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.drop-label {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.drop-hint {
  font-size: 0.75rem;
  opacity: 0.6;
  font-weight: 500;
}

/* Compare Toast Notification */
.compare-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  z-index: 9999;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  background: rgba(24, 24, 37, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
}
.compare-toast.success {
  border-color: #10b981;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.25);
}
.compare-toast.warn, .compare-toast.error {
  border-color: #f43f5e;
  box-shadow: 0 10px 30px rgba(244, 63, 94, 0.25);
}
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px) scale(0.95);
}

.win95 .action-bar { background: #c0c0c0; border: 2px outset #fff; border-radius: 0; box-shadow: none; }
.win95 .icon-btn, .win95 .mode-btn { border: 2px outset #fff; border-radius: 0; background: #c0c0c0; }
.win95 .icon-btn.active, .win95 .mode-btn.active { border: 2px inset #fff; background: #d0d0d0; }
.win95 .editor-wrapper, .win95 .image-wrapper { border: 2px inset #fff; border-radius: 0; }
.win95 .drop-overlay { background: rgba(192, 192, 192, 0.85); }
.win95 .drop-zone { border: 2px dashed #000; border-radius: 0; background: #c0c0c0; }
.win95 .drop-zone.active { background: #000080; border-color: #ffff00; }
.win95 .drop-zone.active .drop-indicator { color: #fff; }
.win95-toast {
  border: 2px outset #fff !important;
  background: #c0c0c0 !important;
  color: #000 !important;
  border-radius: 0 !important;
  box-shadow: 4px 4px 0 #000 !important;
}

</style>
