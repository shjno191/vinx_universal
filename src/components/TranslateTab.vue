<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import { translateInput, translateOutput, sharedTargetLang, triggerDictionaryFocus, triggerCloseModals, triggerSettingsRefresh, activeTab } from '../store';


const subTab = ref<'dictionary' | 'quick-translate'>('quick-translate');
const dictionaryData = ref<any[]>([]);
const isLoading = ref(false);
const dictionaryPath = ref('');
const dictionarySearchInput = ref<HTMLInputElement | null>(null);
const localSearchQuery = ref('');
const isStrict = ref(false);


// Performance optimizations
const debouncedInput = ref(translateInput.value);
let debounceTimer: any = null;
const sourceRegex = ref<RegExp | null>(null);
const targetRegex = ref<RegExp | null>(null);
const sourceWordsList = ref<string[]>([]);
const targetWordsList = ref<string[]>([]);

// Copy feedback
const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });
const hoveredWord = ref<string | null>(null);


// Modal state
const showDictModal = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingIdx = ref<number | null>(null);
const editBuffer = ref({ jp: '', en: '', vi: '' });

// References for syncing scroll
const inputTextarea = ref<HTMLTextAreaElement | null>(null);
const resultTextarea = ref<HTMLTextAreaElement | null>(null);
const inputLineNumbers = ref<HTMLDivElement | null>(null);
const resultLineNumbers = ref<HTMLDivElement | null>(null);

const maxLines = computed(() => {
  const iLines = translateInput.value.split('\n').length;
  const oLines = translateOutput.value.split('\n').length;
  return Math.max(iLines, oLines, 1);
});


const syncScroll = (side: 'input' | 'result') => {
  const source = side === 'input' ? inputTextarea.value : resultTextarea.value;
  const target = side === 'input' ? resultTextarea.value : inputTextarea.value;
  const sourceHL = side === 'input' ? inputHighlighter.value : resultHighlighter.value;
  const targetHL = side === 'input' ? resultHighlighter.value : inputHighlighter.value;
  const sourceLN = side === 'input' ? inputLineNumbers.value : resultLineNumbers.value;
  const targetLN = side === 'input' ? resultLineNumbers.value : inputLineNumbers.value;

  if (!source) return;

  // Sync the current side's own highlighter and line numbers
  if (sourceHL) {
    sourceHL.scrollTop = source.scrollTop;
    sourceHL.scrollLeft = source.scrollLeft;
  }
  if (sourceLN) {
    sourceLN.scrollTop = source.scrollTop;
  }

  // Sync the OTHER side
  if (target) {
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  }
  if (targetHL) {
    targetHL.scrollTop = source.scrollTop;
    targetHL.scrollLeft = source.scrollLeft;
  }
  if (targetLN) {
    targetLN.scrollTop = source.scrollTop;
  }
};


const loadDictionary = async () => {
  try {
    isLoading.value = true;
    const raw = await invoke('get_settings') as string;
    const s = JSON.parse(raw || "{}");
    dictionaryPath.value = s?.dictionary_path || '';

    if (!dictionaryPath.value) {
      dictionaryData.value = [];
      isLoading.value = false;
      return;
    }

    const bytes = await invoke('read_file_binary', { path: dictionaryPath.value }) as number[];
    const data = new Uint8Array(bytes);
    const workbook = XLSX.read(data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length > 0) {
      const rows = jsonData.slice(1)
        .map(row => ({
          jp: (row[0] || '').toString().trim(),
          en: (row[1] || '').toString().trim(),
          vi: (row[2] || '').toString().trim()
        }))
        .filter(row => row.jp !== '' || row.en !== '' || row.vi !== '');
      dictionaryData.value = rows;
      updateCachedWords();
    }
  } catch (e) {
    console.error('Failed to load dictionary:', e);
  } finally {
    isLoading.value = false;
  }
};

const cleanDictionaryDuplicates = async () => {
  if (!dictionaryData.value.length || !dictionaryPath.value) return;

  const confirmed = await ask(
    `Are you sure you want to remove duplicates from the Excel file?\nThis will overwrite the current file.`,
    { title: 'Confirm Clean Duplicates', kind: 'warning' }
  );
  if (!confirmed) return;

  const initialCount = dictionaryData.value.length;
  const seen = new Set();
  const cleaned = dictionaryData.value.filter(item => {
    // Key is combination of Japanese and English
    const key = `${normalize(item.jp).toLowerCase()}|||${normalize(item.en).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const removedCount = initialCount - cleaned.length;
  if (removedCount === 0) {
    alert('No duplicates found.');
    return;
  }

  try {
    // 1. Prepare data for Excel (Array of Arrays with headers)
    const aoa = [
      ['JAPANESE', 'ENGLISH', 'VIETNAMESE'],
      ...cleaned.map(item => [item.jp, item.en, item.vi])
    ];

    // 2. Create workbook
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dictionary");

    // 3. Generate binary data
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    
    // 4. Save to file
    await invoke('write_file_binary', { 
      path: dictionaryPath.value, 
      data: Array.from(new Uint8Array(wbout)) 
    });

    // 5. Update local state
    dictionaryData.value = cleaned;
    updateCachedWords();
    
    alert(`Cleaned successfully! Removed ${removedCount} duplicate rows.`);
  } catch (e) {
    console.error('Failed to clean dictionary:', e);
    alert('Failed to save cleaned dictionary: ' + e);
  }
};

const normalize = (val: string) => val ? val.trim() : '';

const updateCachedWords = () => {
  const sourceSet = new Set<string>();
  const targetSet = new Set<string>();
  const targetKey = sharedTargetLang.value;

  dictionaryData.value.forEach(d => {
    const tVal = (d[targetKey] || '').trim();
    if (tVal && tVal.length > 1) targetSet.add(tVal);
    
    ['jp', 'en', 'vi'].forEach(l => {
      if (l !== targetKey) {
        const sVal = (d[l as 'jp'|'en'|'vi'] || '').trim();
        if (sVal && sVal.length > 1) sourceSet.add(sVal);
      }
    });
  });

  const sList = Array.from(sourceSet).sort((a, b) => b.length - a.length);
  const tList = Array.from(targetSet).sort((a, b) => b.length - a.length);
  
  sourceWordsList.value = sList;
  targetWordsList.value = tList;

  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  if (sList.length > 0) {
    sourceRegex.value = new RegExp('(' + sList.map(escape).join('|') + ')', 'g');
  } else {
    sourceRegex.value = null;
  }
  
  if (tList.length > 0) {
    targetRegex.value = new RegExp('(' + tList.map(escape).join('|') + ')', 'g');
  } else {
    targetRegex.value = null;
  }
};

const filteredDictionary = computed(() => {
  if (!localSearchQuery.value) return dictionaryData.value;
  const q = localSearchQuery.value.toLowerCase().trim();
  
  return dictionaryData.value.filter(item => {
    if (isStrict.value) {
      return item.jp.toLowerCase() === q || 
             item.en.toLowerCase() === q || 
             item.vi.toLowerCase() === q;
    }
    return item.jp.toLowerCase().includes(q) || 
           item.en.toLowerCase().includes(q) || 
           item.vi.toLowerCase().includes(q);
  });
});


const handleQuickTranslate = () => {
  if (!translateInput.value) {
    translateOutput.value = '';
    return;
  }

  if (sourceWordsList.value.length === 0) {
    translateOutput.value = translateInput.value;
    return;
  }

  const targetKey = sharedTargetLang.value;
  const lookup = new Map<string, string>();
  dictionaryData.value.forEach(entry => {
    const tVal = (entry[targetKey] || '').toString().trim();
    if (!tVal) return;
    ['jp', 'en', 'vi'].forEach(l => {
      if (l !== targetKey) {
        const sVal = (entry[l as 'jp'|'en'|'vi'] || '').toString().trim();
        if (sVal && sVal !== tVal) {
          if (!lookup.has(sVal) || sVal.length > (lookup.get(sVal)?.length || 0)) {
            lookup.set(sVal, tVal);
          }
        }
      }
    });
  });

  const sortedPairs = sourceWordsList.value;

  let result = '';
  let i = 0;
  const text = translateInput.value;

  while (i < text.length) {
    let matchFound = false;

    for (const sourceWord of sortedPairs) {
      if (text.startsWith(sourceWord, i)) {
        result += lookup.get(sourceWord) || sourceWord;
        i += sourceWord.length;
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      result += text[i];
      i++;
    }
  }

  translateOutput.value = result;
};

const clearAll = () => {
  translateInput.value = '';
  translateOutput.value = '';
};

const formatInputText = () => {
  let text = translateInput.value;
  if (!text) return;

  // New Logic: Extract SQL data from Java append strings
  if (text.includes('.append(')) {
    const lines = text.split('\n');
    const results = lines.map(line => {
      const match = line.match(/\.append\s*\(\s*["'](.*?)["']\s*\)/i);
      if (match) {
        let content = match[1].trim();
        if (content.includes('?')) return null;
        return content.replace(/,$/, '').trim();
      }
      return null;
    }).filter(row => row !== null && row.length > 0);

    if (results.length > 0) {
      translateInput.value = results.join('\n');
      nextTick(() => handleQuickTranslate());
      return;
    }
  }

  // Basic formatting fallback
  const formatted = text
    .split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
  translateInput.value = formatted;
};



const copyResult = async () => {
  if (!translateOutput.value) return;
  try {
    await navigator.clipboard.writeText(translateOutput.value);
    alert('Result copied to clipboard!');
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

const openExcel = async () => {
  if (dictionaryPath.value) {
    try {
      await invoke('open_file_path', { path: dictionaryPath.value });
    } catch (e) {
      alert('Failed to open Excel file: ' + e);
    }
  } else {
    alert('Please configure dictionary path in Settings first.');
  }
};


const copyToClipboard = async (text: string, event: MouseEvent) => {
  const cleanText = text ? text.replace(/<[^>]*>/g, '').trim() : '';
  if (!cleanText) return;
  try {
    await navigator.clipboard.writeText(cleanText);
    
    copyPos.value = { x: event.clientX, y: event.clientY };
    showCopyToast.value = true;
    setTimeout(() => { showCopyToast.value = false; }, 1200);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

const handleHighlighterClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'MARK') {
    copyToClipboard(target.innerText, event);
  }
};

const handleHighlighterMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'MARK') {
    hoveredWord.value = target.innerText;
  }
};

const handleHighlighterMouseOut = () => {
  hoveredWord.value = null;
};


const highlightMatch = (text: string) => {
  if (!localSearchQuery.value || isStrict.value) return text;
  const q = localSearchQuery.value.trim();
  if (!q) return text;
  try {
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="local-match">$1</mark>');
  } catch { return text; }
};


// --- CRUD ---
const openAddModal = () => {
  modalMode.value = 'add';
  editBuffer.value = { jp: '', en: '', vi: '' };
  showDictModal.value = true;
};

const openEditModal = (item: any) => {
  modalMode.value = 'edit';
  editingIdx.value = dictionaryData.value.indexOf(item);
  editBuffer.value = { ...item };
  showDictModal.value = true;
};

const saveModalData = () => {
  if (modalMode.value === 'add') {
    dictionaryData.value.unshift({ ...editBuffer.value });
  } else if (editingIdx.value !== null) {
    dictionaryData.value[editingIdx.value] = { ...editBuffer.value };
  }
  showDictModal.value = false;
  editingIdx.value = null;
};

const deleteRow = async (item: any) => {
  const c = await ask('Are you sure you want to delete this row?', { title: 'Confirm', kind: 'warning' });
  if (c) {
    const idx = dictionaryData.value.indexOf(item);
    if (idx !== -1) dictionaryData.value.splice(idx, 1);
  }
};

// Highlighting Logic
const renderHighlighted = (text: string, mode: 'source' | 'target') => {
  if (!text) return '';
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const regex = mode === 'source' ? sourceRegex.value : targetRegex.value;
  
  let result = escaped;
  if (regex) {
    result = escaped.replace(regex, (match) => {
      // Attribute safe escape
      const attrMatch = match.replace(/"/g, '&quot;');
      return `<mark class="hl-${mode}" data-word="${attrMatch}">${match}</mark>`;
    });
  }

  return result;
};


const highlightedInput = ref('');
const highlightedOutput = ref('');

let translateHighlightTimeout: any = null;

const updateAllHighlights = () => {
    highlightedInput.value = renderHighlighted(debouncedInput.value, 'source');
    highlightedOutput.value = renderHighlighted(translateOutput.value, 'target');
};

// Update highlights on content or search query change, but debounced and gated by visibility
watch([debouncedInput, translateOutput, activeTab], () => {
    if (translateHighlightTimeout) clearTimeout(translateHighlightTimeout);
    
    if (activeTab.value !== 'Translate') return;
    
    translateHighlightTimeout = setTimeout(() => {
        updateAllHighlights();
    }, 400);
}, { immediate: true });

const hoverStyleTag = ref<HTMLStyleElement | null>(null);
watch(hoveredWord, (newWord) => {
  if (!hoverStyleTag.value) {
    hoverStyleTag.value = document.createElement('style');
    hoverStyleTag.value.id = 'sync-hover-styles';
    document.head.appendChild(hoverStyleTag.value);
  }
  
  if (newWord && activeTab.value === 'Translate') {
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(newWord) : newWord.replace(/["\\]/g, '\\$&');
    hoverStyleTag.value.innerHTML = `
      mark[data-word="${escaped}"] {
        background: var(--accent-color) !important;
        color: white !important;
        border-radius: 4px;
        box-shadow: 0 0 10px var(--accent-color);
        text-decoration: none !important;
      }
    `;
  } else {
    hoverStyleTag.value.innerHTML = '';
  }
});


// Ensure highlights are ready when user switches to this tab
watch(activeTab, (newTab) => {
    if (newTab === 'Translate') {
        updateAllHighlights();
    }
});

const handleScroll = (side: 'input' | 'result') => {
  syncScroll(side);
};


const inputHighlighter = ref<HTMLDivElement | null>(null);
const resultHighlighter = ref<HTMLDivElement | null>(null);

onMounted(() => {
  loadDictionary();
  window.addEventListener('keydown', handleLocalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleLocalKeyDown);
});

const handleLocalKeyDown = (e: KeyboardEvent) => {
  if (activeTab.value !== 'Translate') return;
  
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
    if (subTab.value === 'dictionary') {
      e.preventDefault();
      dictionarySearchInput.value?.focus();
      dictionarySearchInput.value?.select();
    }
  }
};

watch(translateInput, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedInput.value = val;
    handleQuickTranslate();
  }, 300);
});
watch(translateOutput, async () => {
  await nextTick();
  if (subTab.value === 'quick-translate') syncScroll('result');
});
watch(subTab, async () => {
  await nextTick();
  if (subTab.value === 'quick-translate') {
    syncScroll('input'); syncScroll('result');
  }
});

watch(sharedTargetLang, () => {
  updateCachedWords();
  handleQuickTranslate();
});

watch(triggerDictionaryFocus, async () => {
  await nextTick();
  if (dictionarySearchInput.value) {
    dictionarySearchInput.value.focus();
    dictionarySearchInput.value.select();
  }
});

watch(triggerCloseModals, () => {
  showDictModal.value = false;
});

watch(triggerSettingsRefresh, () => {
  loadDictionary();
});

watch(dictionaryData, () => {
  updateCachedWords();
  if (subTab.value === 'quick-translate' && translateInput.value) {
    handleQuickTranslate();
  }
}, { deep: true });
</script>

<template>
  <div class="premium-translate">
    <header class="main-header">
      <div class="tabs-pill">
        <button @click="subTab = 'dictionary'" :class="{ active: subTab === 'dictionary' }" class="tab-pill-btn">DICTIONARY</button>
        <button @click="subTab = 'quick-translate'" :class="{ active: subTab === 'quick-translate' }" class="tab-pill-btn">QUICK TRANSLATE</button>
      </div>
      
      <div v-if="subTab === 'dictionary'" class="search-container">
        <div class="search-box">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="localSearchQuery" ref="dictionarySearchInput" placeholder="Search dictionary..." class="header-search-input" />
        </div>
        <label class="strict-mode">
          <input type="checkbox" v-model="isStrict" />
          <span>STRICT</span>
        </label>
      </div>


      <div class="global-actions">
        <button v-if="subTab === 'dictionary' && dictionaryData.length > 0" @click="cleanDictionaryDuplicates" class="action-btn-danger">CLEAN DUPLICATES</button>
        <button @click="openExcel" class="action-btn-mint">OPEN EXCEL</button>
      </div>
    </header>

    <div class="tab-body">
      <!-- Dictionary View -->
      <div v-if="subTab === 'dictionary'" class="dictionary-container">
        <div class="dict-table-wrapper glass">
          <table class="dict-table">
            <thead>
              <tr>
                <th class="col-index">#</th>
                <th>JAPANESE</th>
                <th>ENGLISH</th>
                <th>VIETNAMESE</th>
                <th class="col-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading">
                <td colspan="5" class="empty-state">Loading dictionary...</td>
              </tr>
              <tr v-else-if="filteredDictionary.length === 0">
                <td colspan="5" class="empty-state">
                  {{ dictionaryPath ? 'No matches found.' : 'Please configure dictionary path in Settings.' }}
                </td>
              </tr>
              <tr v-for="(item, idx) in filteredDictionary.slice(0, 100)" :key="idx" v-else>
                <td class="col-index">{{ idx + 1 }}</td>
                <td @click="copyToClipboard(item.jp, $event)" class="clickable-cell"><span v-html="highlightMatch(item.jp)"></span></td>
                <td @click="copyToClipboard(item.en, $event)" class="clickable-cell code-text"><span v-html="highlightMatch(item.en)"></span></td>
                <td @click="copyToClipboard(item.vi, $event)" class="clickable-cell"><span class="lang-tag" v-html="highlightMatch(item.vi)"></span></td>
                <td class="col-actions">
                  <div class="action-icons">
                    <button @click="openEditModal(item)" class="icon-action-btn edit" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button @click="deleteRow(item)" class="icon-action-btn delete" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredDictionary.length > 100">
                <td colspan="5" class="empty-state" style="padding: 15px !important; font-size: 0.7rem;">
                  ... showing first 100 of {{ filteredDictionary.length }} results. Use search to find specific items.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Floating Add Button -->
        <button @click="openAddModal" class="fab-add-btn" title="Add Entry">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      <!-- Quick Translate View -->
      <div v-if="subTab === 'quick-translate'" class="quick-translate-container">
        <div class="split-panes">
          <div class="pane-group">
            <div class="pane-header">
              <span class="pane-label">INPUT SOURCE</span>
              <div class="header-right">
                <button @click="formatInputText" class="ghost-btn format-btn">FORMAT</button>
                <button @click="clearAll" class="clear-btn">CLEAR ALL</button>
              </div>
            </div>
            <div class="pane-editor glass">
              <div class="line-numbers" ref="inputLineNumbers"><div v-for="n in maxLines" :key="n" class="line-num">{{ n }}</div></div>

              <div class="editor-sub-container">
                <textarea v-model="translateInput" ref="inputTextarea" @scroll="handleScroll('input')" placeholder="Paste text here..."></textarea>
                <div class="highlighter" v-html="highlightedInput" ref="inputHighlighter" @click="handleHighlighterClick" @mouseover="handleHighlighterMouseOver" @mouseout="handleHighlighterMouseOut"></div>

              </div>
            </div>
          </div>
          <div class="pane-group">
            <div class="pane-header">
              <div class="header-left"><span class="pane-label">RESULT TO:</span>
                <div class="lang-segmented">
                  <button @click="sharedTargetLang = 'en'" :class="{ active: sharedTargetLang === 'en' }">EN</button>
                  <button @click="sharedTargetLang = 'jp'" :class="{ active: sharedTargetLang === 'jp' }">JP</button>
                  <button @click="sharedTargetLang = 'vi'" :class="{ active: sharedTargetLang === 'vi' }">VI</button>
                </div>
              </div>
              <div class="header-right"><button @click="copyResult" class="ghost-btn">COPY RESULT</button></div>
            </div>
            <div class="pane-editor glass">
              <div class="line-numbers" ref="resultLineNumbers"><div v-for="n in maxLines" :key="n" class="line-num">{{ n }}</div></div>

              <div class="editor-sub-container">
                <textarea v-model="translateOutput" readonly ref="resultTextarea" @scroll="handleScroll('result')" placeholder="Translation..." class="clickable-result"></textarea>
                <div class="highlighter" v-html="highlightedOutput" ref="resultHighlighter" @click="handleHighlighterClick" @mouseover="handleHighlighterMouseOver" @mouseout="handleHighlighterMouseOut"></div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Copy Bubble -->
    <transition name="bubble">
      <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">
        Copied!
      </div>
    </transition>

    <!-- Modal (Light Themed) -->
    <div v-if="showDictModal" class="modal-overlay">
      <div class="modal-content glass-modal">
        <div class="modal-header-modern">
          <h3>{{ modalMode === 'add' ? 'ADD NEW ENTRY' : 'EDIT ENTRY' }}</h3>
          <button @click="showDictModal = false" class="close-modal-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-field"><label>JAPANESE</label><input v-model="editBuffer.jp" placeholder="JP word..." /></div>
          <div class="modal-field"><label>ENGLISH</label><input v-model="editBuffer.en" placeholder="EN word..." /></div>
          <div class="modal-field"><label>VIETNAMESE</label><input v-model="editBuffer.vi" placeholder="VI word..." /></div>
        </div>
        <div class="modal-footer">
          <button @click="showDictModal = false" class="ghost-btn">CANCEL</button>
          <button @click="saveModalData" class="action-btn-purple">SAVE CHANGES</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.premium-translate { display: flex; flex-direction: column; height: 100%; padding: 10px 15px; background: var(--container-bg); gap: 15px; box-sizing: border-box; overflow: hidden; }
.main-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-shrink: 0; }
.tabs-pill { display: flex; background: rgba(128, 128, 128, 0.1); padding: 4px; border-radius: 50px; }
.tab-pill-btn { padding: 8px 18px; border: none; background: transparent; color: var(--text-color); font-weight: 800; font-size: 0.65rem; border-radius: 40px; cursor: pointer; opacity: 0.6; transition: 0.3s; }
.tab-pill-btn.active { background: #fff; color: #6366f1; box-shadow: 0 4px 15px rgba(0,0,0,0.1); opacity: 1; }
.search-container { flex: 1; display: flex; align-items: center; gap: 10px; max-width: 500px; position: relative; }
.search-box { flex: 1; display: flex; align-items: center; background: rgba(128,128,128,0.08); border-radius: 50px; padding: 0 15px; height: 36px; border: 1px solid rgba(128,128,128,0.15); }

/* Quick Search Popup */
.quick-search-popup {
  position: absolute;
  top: 110%;
  left: 0;
  width: 100%;
  max-height: 400px;
  background: var(--container-bg);
  border: 1px solid var(--accent-color);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.2s ease-out;
}
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.popup-header { padding: 8px 15px; background: var(--accent-color); color: #fff; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.05em; }
.popup-list { overflow-y: auto; }
.popup-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 10px 15px; border-bottom: 1px solid rgba(128,128,128,0.08); cursor: pointer; transition: 0.2s; }
.popup-row:hover { background: rgba(99, 102, 241, 0.05); }
.popup-col { font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.popup-col.jp { font-weight: bold; color: var(--accent-color); }
.popup-footer { padding: 8px 15px; font-size: 0.65rem; text-align: center; opacity: 0.6; cursor: pointer; background: rgba(128,128,128,0.03); }
.popup-footer:hover { opacity: 1; color: var(--accent-color); }

.search-icon { opacity: 0.5; margin-right: 10px; color: var(--text-color); }
.header-search-input { flex: 1; background: transparent; border: none; color: #6366f1; font-weight: 800; font-size: 0.8rem; outline: none; }
.strict-mode { display: flex; align-items: center; gap: 5px; font-size: 0.6rem; font-weight: 900; opacity: 0.5; color: var(--text-color); cursor: pointer; }
.strict-mode input { cursor: pointer; }
:deep(.local-match) { background: #6366f1; color: white; border-radius: 2px; padding: 0 2px; }

.fab-add-btn {
  position: absolute;
  bottom: 25px;
  right: 25px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: #6366f1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}
.fab-add-btn:hover {
  transform: scale(1.1) rotate(90deg);
  box-shadow: 0 15px 30px rgba(99, 102, 241, 0.5);
}
.global-actions { display: flex; gap: 10px; }
.action-btn-mint { padding: 8px 15px; background: #ecfdf5; color: #10b981; border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
.action-btn-danger { padding: 8px 15px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; margin-right: 5px; }
.action-btn-danger:hover { background: rgba(244, 63, 94, 0.2); }
.action-btn-purple { padding: 8px 15px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
.dictionary-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.dict-table-wrapper { flex: 1; overflow-y: auto; border-radius: 12px; }
.dict-table { width: 100%; border-collapse: collapse; }
.dict-table th { position: sticky; top: 0; background: #6366f1; color: #fff; padding: 12px 15px; text-align: left; font-size: 0.65rem; font-weight: 800; z-index: 5; }
.dict-table tbody tr { transition: background 0.2s; }
.dict-table tbody tr:hover { background-color: rgba(99, 102, 241, 0.04); }
.dict-table td { padding: 10px 15px; font-size: 0.8rem; border-bottom: 1px solid rgba(128,128,128,0.08); color: var(--text-color); }
.clickable-cell { cursor: pointer; transition: background 0.2s; }
.clickable-cell:hover { background: rgba(99, 102, 241, 0.06); }
.clickable-cell:active { background: rgba(99, 102, 241, 0.1); }
.col-index { text-align: center; opacity: 0.4; }
.col-actions { text-align: center; width: 80px; }
.action-icons { display: flex; justify-content: center; gap: 5px; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.dict-table tbody tr:hover .action-icons { opacity: 1; pointer-events: auto; }
.icon-action-btn { width: 28px; height: 28px; border: 1px solid rgba(128,128,128,0.15); background: var(--container-bg); color: var(--text-color); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.icon-action-btn:hover { background: var(--button-hover); }
.icon-action-btn.edit { color: #6366f1; }
.icon-action-btn.delete { color: #f43f5e; }
.quick-translate-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.split-panes { display: flex; gap: 15px; height: 100%; }
.pane-group { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.pane-header { display: flex; justify-content: space-between; align-items: center; height: 30px; }
.pane-label { font-size: 0.6rem; font-weight: 950; opacity: 0.4; letter-spacing: 0.05em; color: var(--text-color); }
.clear-btn { background: rgba(239,68,68,0.1); color: #f43f5e; border: none; padding: 4px 10px; font-size: 0.6rem; font-weight: 900; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
.clear-btn:hover { background: rgba(239,68,68,0.2); }
.format-btn { margin-right: 6px; border-color: rgba(99,102,241,0.2); color: var(--accent-color); }
.format-btn:hover { background: rgba(99,102,241,0.1); }
.ghost-btn { background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.1); padding: 4px 10px; font-size: 0.6rem; font-weight: 900; border-radius: 6px; cursor: pointer; color: var(--text-color); }
.lang-segmented { display: flex; background: rgba(128, 128, 128, 0.06); padding: 2px; border-radius: 8px; }
.lang-segmented button { padding: 4px 10px; font-size: 0.6rem; border: none; background: transparent; font-weight: 950; border-radius: 6px; cursor: pointer; opacity: 0.4; color: var(--text-color); }
.lang-segmented button.active { background: #3b82f6; color: #fff; opacity: 1; }
.pane-editor { flex: 1; display: flex; overflow: hidden; border-radius: 12px; border: 1px solid rgba(128,128,128,0.12); }
.line-numbers { width: 34px; background: rgba(0,0,0,0.02); padding: 15px 0; overflow: hidden; }
.line-num { font-size: 0.85rem; line-height: 1.6; text-align: center; opacity: 0.2; font-family: 'Consolas', monospace; color: var(--text-color); }

.editor-sub-container { position: relative; flex: 1; display: flex; overflow: hidden; }
.highlighter {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  padding: 15px; box-sizing: border-box;
  font-family: 'Consolas', monospace; font-size: 0.85rem; line-height: 1.6;
  white-space: pre; overflow: hidden; word-break: normal;

  color: transparent; pointer-events: none; z-index: 2;
}
:deep(mark.hl-source) { background: transparent; color: var(--accent-color); font-weight: normal; text-shadow: 0 0 0.5px currentColor; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; pointer-events: auto; transition: all 0.2s; }
:deep(mark.hl-target) { background: transparent; color: #10b981; font-weight: normal; text-shadow: 0 0 0.5px currentColor; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; pointer-events: auto; transition: all 0.2s; }




textarea {
  flex: 1; background: transparent; border: none; padding: 15px;
  color: var(--text-color); font-family: 'Consolas', monospace; font-size: 0.85rem; line-height: 1.6;
  resize: none; outline: none; position: relative; z-index: 1;
  white-space: pre; overflow: auto; word-break: normal;

}

.clickable-result { transition: background 0.2s; }
.clickable-result:hover { background: rgba(99, 102, 241, 0.01); }
.glass { background: var(--input-bg); }
.tab-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Modal Design Fix */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.glass-modal { background: var(--container-bg); border: 1px solid var(--accent-color); border-radius: 16px; width: 420px; padding: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); color: var(--text-color); }
.modal-header-modern { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-header-modern h3 { font-size: 0.85rem; font-weight: 950; color: #6366f1; letter-spacing: 0.05em; }
.close-modal-btn { background: transparent; border: none; color: var(--text-color); cursor: pointer; opacity: 0.5; transition: 0.2s; }
.close-modal-btn:hover { opacity: 1; transform: scale(1.1); }
.modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; }
.modal-field label { font-size: 0.6rem; font-weight: 950; opacity: 0.6; }
.modal-field input { background: var(--bg-color); border: 1px solid rgba(128,128,128,0.2); border-radius: 10px; padding: 12px; color: var(--text-color); font-size: 0.85rem; outline: none; transition: 0.2s; }
.modal-field input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; }

/* Bubble styles */
.copy-bubble {
  position: fixed;
  background: #10b981;
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 900;
  box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
  z-index: 3000;
  pointer-events: none;
  transform: translateX(-50%);
}
.bubble-enter-active, .bubble-leave-active { transition: all 0.2s ease; }
.bubble-enter-from { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
.bubble-leave-to { opacity: 0; transform: translate(-50%, -10px) scale(0.8); }
.empty-state { padding: 40px !important; text-align: center; opacity: 0.5; font-style: italic; }
</style>
