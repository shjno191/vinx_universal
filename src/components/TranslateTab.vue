<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useTranslateManager } from '../composables/useTranslateManager';
import { useSettings } from '../composables/useSettings';
import { useClipboard } from '../composables/useClipboard';
import { Icons } from '../utils/icons';
import { listSystemControls } from '../utils/systemControl';
import { invoke } from '@tauri-apps/api/core';
import { advancedTranslatePaths } from '../store';

// Sub-components
import DictionaryTable from './translate/DictionaryTable.vue';
import TranslationPane from './translate/TranslationPane.vue';

// Store imports for shared state
import { 
  translateInput, 
  translateOutput, 
  sharedTargetLang, 
  activeTab,
  systemControlSettings,
  globalDictionaryPath
} from '../store';

const props = defineProps<{ theme?: string }>();

// --- Initialization ----------------------------------------------------------
const { settings, pickAdvancedPath } = useSettings();
const {
  subTab,
  dictionaryData,
  isLoading,
  localSearchQuery,
  isOnlySelectedSheets,
  isStrict,
  advancedConfigs,
  selectedFolder,
  excelFilesInFolder,
  selectedFile,
  sheetsOfSelectedFile,
  selectedSheets,
  fileSheetCounts,
  sheetRowCounts,
  sheetMetadata,
  fileSearchQuery,
  sheetSearchQuery,
  debouncedInput,
  sourceWordsList,
  targetWordsList,
  loadDictionary,
  loadFilesFromMultipleFolders,
  selectExcelFile,
  loadSingleSheet,
  updateCachedWords,
  performQuickTranslate,
  rebuildBaseDictionaryCache,
  saveDictionaryFile
} = useTranslateManager();

// Sync files from multiple folders defined in store
watch(advancedTranslatePaths, (newPaths) => {
  if (newPaths && newPaths.length > 0) {
    loadFilesFromMultipleFolders(newPaths);
  } else {
    excelFilesInFolder.value = [];
  }
}, { deep: true, immediate: true });

const { copyToClipboard } = useClipboard();

// --- Local Script States & UI Helpers ----------------------------------------
const dictionarySearchInput = ref<HTMLInputElement | null>(null);
const paneRef = ref<any>(null);
const hoveredLineIndex = ref<number | null>(null);
const hoveredWord = ref<string | null>(null);

// Modal state
const showDictModal = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingIdx = ref<number | null>(null);
const editBuffer = ref({ jp: '', en: '', vi: '' });

// Toast Feedbacks
const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });

// --- UI Actions & Handlers ----------------------------------------------------

const syncScroll = (side: 'input' | 'result') => {
  if (!paneRef.value) return;
  const source = side === 'input' ? paneRef.value.inputTextarea : paneRef.value.resultTextarea;
  const target = side === 'input' ? paneRef.value.resultTextarea : paneRef.value.inputTextarea;
  const sourceHL = side === 'input' ? paneRef.value.inputHighlighter : paneRef.value.resultHighlighter;
  const targetHL = side === 'input' ? paneRef.value.resultHighlighter : paneRef.value.inputHighlighter;
  const sourceLN = side === 'input' ? paneRef.value.inputLineNumbers : paneRef.value.resultLineNumbers;
  const targetLN = side === 'input' ? paneRef.value.resultLineNumbers : paneRef.value.inputLineNumbers;

  if (!source) return;

  if (sourceHL) { sourceHL.scrollTop = source.scrollTop; sourceHL.scrollLeft = source.scrollLeft; }
  if (sourceLN) sourceLN.scrollTop = source.scrollTop;

  if (target) { target.scrollTop = source.scrollTop; target.scrollLeft = source.scrollLeft; }
  if (targetHL) { targetHL.scrollTop = source.scrollTop; targetHL.scrollLeft = source.scrollLeft; }
  if (targetLN) targetLN.scrollTop = source.scrollTop;
};

const handleCopyFeedback = async (text: string, event: MouseEvent) => {
  const cleanText = text ? text.trim() : '';
  if (!cleanText) return;
  const success = await copyToClipboard(cleanText);
  if (success) {
    copyPos.value = { x: event.clientX, y: event.clientY };
    showCopyToast.value = true;
    setTimeout(() => { showCopyToast.value = false; }, 1200);
  }
};

const handleHighlighterClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'MARK') handleCopyFeedback(target.innerText, event);
};

const handleHighlighterMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'MARK') hoveredWord.value = target.innerText;
};

const handleHighlighterMouseOut = () => { hoveredWord.value = null; };

const handleEditorMouseMove = (e: MouseEvent, target: HTMLTextAreaElement | null) => {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const scrollY = target.scrollTop;
  const contentY = y + scrollY - 15;
  if (contentY < 0) { hoveredLineIndex.value = null; return; }
  const remValue = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const lineHeightPx = 0.85 * remValue * 1.6;
  const idx = Math.floor(contentY / lineHeightPx) + 1;
  const maxL = Math.max(translateInput.value.split('\n').length, translateOutput.value.split('\n').length);
  hoveredLineIndex.value = idx <= maxL ? idx : null;
};


// --- Dictionary CRUD ---
const openAddModal = () => { modalMode.value = 'add'; editBuffer.value = { jp: '', en: '', vi: '' }; showDictModal.value = true; };
const openEditModal = (item: any) => { modalMode.value = 'edit'; editingIdx.value = dictionaryData.value.indexOf(item); editBuffer.value = { ...item }; showDictModal.value = true; };
const saveModalData = async () => {
  const newArr = [...dictionaryData.value];
  if (modalMode.value === 'add') newArr.unshift({ ...editBuffer.value });
  else if (editingIdx.value !== null) newArr[editingIdx.value] = { ...editBuffer.value };
  
  dictionaryData.value = newArr; 
  showDictModal.value = false;
  
  // Persist to physical file
  if (globalDictionaryPath.value) {
    try {
      await saveDictionaryFile(globalDictionaryPath.value, newArr);
      showToast(modalMode.value === 'add' ? 'Entry Added & Saved!' : 'Entry Updated & Saved!');
      rebuildBaseDictionaryCache();
      updateCachedWords();
    } catch (e) {
      showToast('Data updated locally, but failed to save to file.');
    }
  }
};

const deleteEntry = async (item: any) => {
  const newArr = dictionaryData.value.filter(i => i !== item);
  dictionaryData.value = newArr;
  
  if (globalDictionaryPath.value) {
    try {
      await saveDictionaryFile(globalDictionaryPath.value, newArr);
      showToast('Entry Deleted & Saved!');
      rebuildBaseDictionaryCache();
      updateCachedWords();
    } catch (e) {
      showToast('Deleted locally, but failed to sync file.');
    }
  }
};

const toastMessage = ref('');
const showToast = (message: string) => {
  toastMessage.value = message;
  setTimeout(() => { toastMessage.value = ''; }, 3000);
};

const formatInputText = () => {
  let text = translateInput.value;
  if (!text) return;
  translateInput.value = text.split('\n').map(line => line.trim().replace(/\s+/g, ' ')).filter(line => line.length > 0).join('\n').trim();
  nextTick(() => performQuickTranslate());
};

const openExcelFile = async () => {
  if (!globalDictionaryPath.value) return;
  try {
    // Use open_path to open with the actual app (Excel), not just reveal in folder
    await invoke('open_path', { path: globalDictionaryPath.value });
  } catch (error) {
    console.error('[TranslateTab] Failed to open excel file:', error);
  }
};

// --- Lifecycle & Watchers ---
const loadSystemControls = async () => {
  try {
    const controls = await listSystemControls();
    systemControlSettings.value = controls;
    console.log('[TranslateTab] System controls loaded:', controls.length);
  } catch (error) {
    console.error('[TranslateTab] Failed to load system controls:', error);
  }
};

onMounted(async () => {
  await loadSystemControls();
  // We rely on the immediate watch of globalDictionaryPath and advancedTranslatePaths for the initial load
  window.addEventListener('keydown', handleGlobalKeyDown);
});

const handleRefresh = async () => {
  const res = await loadDictionary(globalDictionaryPath.value);
  if (res) {
    if (res.removed > 0) {
      // Actively clean the file when the user presses Refresh
      try {
        await saveDictionaryFile(globalDictionaryPath.value, dictionaryData.value);
        showToast(`Refreshed! Cleaned & Saved ${res.removed} duplicate rows.`);
      } catch (e) {
        showToast(`Refreshed & Cleaned ${res.removed} rows, but failed to save file.`);
      }
    } else {
      showToast('Refreshed! No duplicates found.');
    }
  }
};

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
});

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (activeTab.value !== 'Translate') return;
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
    if (subTab.value === 'dictionary') {
      e.preventDefault(); dictionarySearchInput.value?.focus(); dictionarySearchInput.value?.select();
    }
  }
};

const renderHighlighted = (text: string, mode: 'source' | 'target') => {
  if (!text) return '';
  const patternArr = mode === 'source' ? sourceWordsList.value : targetWordsList.value;
  if (patternArr.length === 0) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pattern = patternArr.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'g');
  
  return escaped.replace(regex, (match) => {
    const attrMatch = match.replace(/"/g, '&quot;');
    return `<mark class="hl-${mode}" data-word="${attrMatch}">${match}</mark>`;
  });
};

const highlightedInput = ref('');
const highlightedOutput = ref('');
let highlightTimer: any = null;

watch([debouncedInput, translateOutput, activeTab], () => {
  if (highlightTimer) clearTimeout(highlightTimer);
  if (activeTab.value !== 'Translate') return;
  highlightTimer = setTimeout(() => {
    highlightedInput.value = renderHighlighted(debouncedInput.value, 'source');
    highlightedOutput.value = renderHighlighted(translateOutput.value, 'target');
  }, 400);
});

const pickQuickTranslateFolder = async () => {
  const selected = await pickAdvancedPath();
  if (selected) {
    await loadFilesFromMultipleFolders(advancedTranslatePaths.value);
    showToast('Folder added and files refreshed!');
  }
};

const hoverStyleTag = ref<HTMLStyleElement | null>(null);
watch(hoveredWord, (newWord) => {
  if (!hoverStyleTag.value) { hoverStyleTag.value = document.createElement('style'); document.head.appendChild(hoverStyleTag.value); }
  if (newWord && activeTab.value === 'Translate') {
    const escaped = CSS.escape(newWord);
    hoverStyleTag.value.innerHTML = `mark[data-word="${escaped}"] { background: var(--accent-color) !important; color: white !important; border-radius: 4px; box-shadow: 0 0 10px var(--accent-color); }`;
  } else { hoverStyleTag.value.innerHTML = ''; }
});

watch(globalDictionaryPath, (newPath) => {
  if (newPath) {
    console.log('[TranslateTab] globalDictionaryPath changed, loading:', newPath);
    loadDictionary(newPath);
  }
}, { immediate: true });

// Sync triggers
watch(isOnlySelectedSheets, () => updateCachedWords());
watch(sharedTargetLang, () => { rebuildBaseDictionaryCache(); updateCachedWords(); });
watch(dictionaryData, () => { rebuildBaseDictionaryCache(); updateCachedWords(); });
</script>

<template>
  <div class="premium-translate" :class="{ 'win95': props.theme === '95' }">
    <header class="main-header glass">
      <div class="tabs-pill">
        <button @click="subTab = 'dictionary'" :class="{ active: subTab === 'dictionary' }" class="tab-pill-btn">DICTIONARY</button>
        <button @click="subTab = 'quick-translate'" :class="{ active: subTab === 'quick-translate' }" class="tab-pill-btn">QUICK TRANSLATE</button>
      </div>
      
      <div v-if="subTab === 'dictionary'" class="search-container">
        <div class="search-box">
          <span class="search-icon" v-html="Icons.Search"></span>
          <input v-model="localSearchQuery" ref="dictionarySearchInput" placeholder="Search dictionary..." class="header-search-input" />
        </div>
        <label class="strict-mode">
          <input type="checkbox" v-model="isStrict" />
          <span>STRICT</span>
        </label>
      </div>

      <div class="header-actions">
        <button v-if="subTab === 'dictionary'" class="action-btn-rect" @click="openExcelFile" title="Open Excel">
          <span v-html="Icons.ExternalLink" class="btn-icon"></span>
          OPEN EXCEL
        </button>
        <button v-if="subTab === 'dictionary'" class="action-btn-circle" @click="openAddModal" title="Add Entry" v-html="Icons.Plus"></button>
        <button v-if="subTab === 'dictionary'" class="action-btn-circle" @click="handleRefresh" title="Refresh" v-html="Icons.RefreshCw"></button>
      </div>
    </header>

    <Teleport to="body">
      <transition name="toast">
        <div v-if="toastMessage" class="vinx-toast glass">
          <span class="toast-icon">✨</span>
          <span class="toast-text">{{ toastMessage }}</span>
        </div>
      </transition>
    </Teleport>

    <div class="tab-body">
      <DictionaryTable 
        v-if="subTab === 'dictionary'"
        :data="dictionaryData"
        :isLoading="isLoading"
        :searchQuery="localSearchQuery"
        :isStrict="isStrict"
        :dictionaryPath="globalDictionaryPath"
        @edit="openEditModal"
        @delete="deleteEntry"
        @copy="handleCopyFeedback"
      />

      <TranslationPane
        v-if="subTab === 'quick-translate'"
        ref="paneRef"
        v-model:input="translateInput"
        v-model:targetLang="sharedTargetLang"
        v-model:hoveredLineIndex="hoveredLineIndex"
        :output="translateOutput"
        :highlighterInput="highlightedInput"
        :highlighterOutput="highlightedOutput"
        :maxLines="Math.max(translateInput.split('\n').length, translateOutput.split('\n').length)"
        @format="formatInputText"
        @clear="() => { translateInput = ''; translateOutput = ''; }"
        @copy="(text, event) => handleCopyFeedback(text, event)"
        @scroll="syncScroll"
        @highlighterClick="handleHighlighterClick"
        @highlighterMouseOver="handleHighlighterMouseOver"
        @highlighterMouseOut="handleHighlighterMouseOut"
        @mouseMove="handleEditorMouseMove"
        :folderPath="selectedFolder"
        :excelFiles="excelFilesInFolder"
        :selectedFile="selectedFile"
        :sheets="sheetsOfSelectedFile"
        :selectedSheets="selectedSheets"
        :fileSheetCounts="fileSheetCounts"
        :sheetRowCounts="sheetRowCounts"
        :sheetMetadata="sheetMetadata"
        v-model:fileSearch="fileSearchQuery"
        v-model:sheetSearch="sheetSearchQuery"
        v-model:isOnlySelectedSheets="isOnlySelectedSheets"
        @selectFolder="pickQuickTranslateFolder"
        @refreshFiles="() => loadFilesFromMultipleFolders(advancedTranslatePaths)"
        @clearSheets="() => { selectedSheets.clear(); updateCachedWords(); }"
        @selectFile="selectExcelFile"
        @toggleSheet="(name) => selectedSheets.has(name) ? selectedSheets.delete(name) : (async () => { selectedSheets.add(name); await loadSingleSheet(selectedFile, name); updateCachedWords(); })()"
      />
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <div v-if="showDictModal" class="modal-overlay">
        <div class="modal-content glass-modal animate-modal">
          <div class="modal-header-modern">
            <div class="header-title-group">
              <span class="header-icon" v-html="modalMode === 'add' ? Icons.Plus : Icons.Edit3"></span>
              <h3>{{ modalMode === 'add' ? 'ADD NEW ENTRY' : 'EDIT ENTRY' }}</h3>
            </div>
            <button @click="showDictModal = false" class="close-modal-btn" v-html="Icons.CloseLarge"></button>
          </div>
          <div class="modal-body">
            <div class="modal-field">
              <label>JAPANESE</label>
              <div class="input-wrapper">
                <input v-model="editBuffer.jp" placeholder="JP word..." />
              </div>
            </div>
            <div class="modal-field">
              <label>ENGLISH</label>
              <div class="input-wrapper">
                <input v-model="editBuffer.en" placeholder="EN word..." />
              </div>
            </div>
            <div class="modal-field">
              <label>VIETNAMESE</label>
              <div class="input-wrapper">
                <input v-model="editBuffer.vi" placeholder="VI word..." />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="showDictModal = false" class="ghost-btn">CANCEL</button>
            <button @click="saveModalData" class="action-btn-purple">
              <span v-html="Icons.Check" style="display:inline-block; margin-right:6px; vertical-align: middle;"></span>
              SAVE CHANGES
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Feedback Toast -->
    <Teleport to="body">
      <transition name="bubble">
        <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">
          <span v-html="Icons.Check" style="display:inline-block; margin-right:4px;"></span>
          Copied!
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.premium-translate { display: flex; flex-direction: column; height: 100%; padding: 12px; background: var(--container-bg); gap: 12px; box-sizing: border-box; overflow: hidden; }
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.main-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-shrink: 0; padding: 10px 16px; border-radius: 12px; }
.tabs-pill { display: flex; background: rgba(0, 0, 0, 0.05); padding: 4px; border-radius: 50px; }
.tab-pill-btn { padding: 6px 16px; border: none; background: transparent; color: var(--text-color); font-weight: 800; font-size: 0.65rem; border-radius: 40px; cursor: pointer; opacity: 0.5; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.tab-pill-btn.active { background: #fff; color: var(--accent-color); box-shadow: 0 4px 12px rgba(0,0,0,0.1); opacity: 1; }
.win95 .tab-pill-btn.active { background: #c0c0c0; color: #000; border: 2px inset #fff; box-shadow: none; }

.search-container { flex: 1; display: flex; align-items: center; gap: 12px; max-width: 500px; position: relative; }
.search-box { flex: 1; display: flex; align-items: center; background: rgba(0,0,0,0.04); border-radius: 50px; padding: 0 12px; height: 32px; border: 1px solid var(--glass-border); transition: border-color 0.2s; }
.search-box:focus-within { border-color: var(--accent-color); }
.search-icon { display: flex; align-items: center; margin-right: 8px; opacity: 0.4; }
.header-search-input { flex: 1; background: transparent; border: none; color: var(--accent-color); font-weight: 800; font-size: 0.75rem; outline: none; }
.strict-mode { display: flex; align-items: center; gap: 6px; font-size: 0.6rem; font-weight: 900; opacity: 0.4; color: var(--text-color); cursor: pointer; transition: opacity 0.2s; }
.strict-mode:hover { opacity: 0.8; }

.header-actions { display: flex; gap: 10px; }
.action-btn-circle { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-color); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.action-btn-circle:hover { border-color: var(--accent-color); color: var(--accent-color); transform: translateY(-1px); background: rgba(99, 102, 241, 0.05); }

.action-btn-rect { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  padding: 0 14px; 
  height: 32px; 
  border-radius: 8px; 
  border: 1px solid var(--accent-color); 
  background: var(--accent-color); 
  color: #fff; 
  font-size: 0.65rem; 
  font-weight: 850; 
  cursor: pointer; 
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}
.action-btn-rect:hover { 
  transform: translateY(-1px); 
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
  filter: brightness(1.1);
}
.btn-icon { display: flex; align-items: center; }

.tab-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.glass-modal { background: var(--container-bg); border: 1px solid var(--glass-border); border-radius: 20px; width: 440px; padding: 24px; box-shadow: 0 32px 64px rgba(0,0,0,0.2); color: var(--text-color); }
.animate-modal { animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes modalPop { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.modal-header-modern { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-title-group { display: flex; align-items: center; gap: 12px; }
.header-icon { opacity: 0.5; color: var(--accent-color); }
.modal-header-modern h3 { font-size: 0.85rem; font-weight: 900; letter-spacing: 0.05em; margin: 0; }
.close-modal-btn { background: transparent; border: none; color: var(--text-color); cursor: pointer; opacity: 0.3; transition: all 0.2s; }
.close-modal-btn:hover { opacity: 1; transform: rotate(90deg); color: #ef4444; }

.modal-body { display: flex; flex-direction: column; gap: 16px; }
.modal-field { display: flex; flex-direction: column; gap: 8px; }
.modal-field label { font-size: 0.6rem; font-weight: 900; opacity: 0.4; letter-spacing: 0.05em; }
.input-wrapper { background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 2px 4px; transition: border-color 0.2s; }
.input-wrapper:focus-within { border-color: var(--accent-color); }
.modal-field input { width: 100%; background: transparent; border: none; padding: 10px; color: var(--text-color); font-size: 0.85rem; outline: none; font-weight: 500; }

.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.ghost-btn { background: transparent; border: 1px solid var(--glass-border); color: var(--text-color); padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.68rem; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.ghost-btn:hover { background: rgba(0,0,0,0.05); transform: translateY(-1px); border-color: var(--accent-color); color: var(--accent-color); }
.action-btn-purple { padding: 8px 22px; background: var(--accent-color); color: #fff; border: none; border-radius: 8px; font-weight: 850; font-size: 0.68rem; cursor: pointer; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.15); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.action-btn-purple:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(99, 102, 241, 0.25); filter: brightness(1.1); }

.copy-bubble { position: fixed; background: #10b981; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 0.65rem; font-weight: 900; z-index: 10000; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3); transform: translateX(-50%); display: flex; align-items: center; }
.bubble-enter-active, .bubble-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.bubble-enter-from { opacity: 0; transform: translate(-50%, 15px) scale(0.8); }
.bubble-leave-to { opacity: 0; transform: translate(-50%, -15px) scale(0.8); }

/* Toast Notification */
.vinx-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10000;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border-radius: 50px;
  white-space: nowrap;
}

.toast-icon { font-size: 1.2rem; }
.toast-text { font-size: 0.85rem; font-weight: 700; color: #fff; letter-spacing: 0.05em; }

.toast-enter-active, .toast-leave-active { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-enter-from { opacity: 0; transform: translate(-50%, 20px) scale(0.9); }
.toast-leave-to { opacity: 0; transform: translate(-50%, -20px) scale(0.9); }

.is-win95 .vinx-toast {
  border-radius: 0;
  background: #c0c0c0 !important;
  border: 2px outset #fff !important;
  transform: translateX(-50%);
  bottom: 40px;
}
.is-win95 .toast-text { color: #000; }
</style>
