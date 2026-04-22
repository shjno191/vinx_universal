<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ask, open } from '@tauri-apps/plugin-dialog';
import * as XLSX from 'xlsx';
import { translateInput, translateOutput, sharedTargetLang, triggerDictionaryFocus, triggerCloseModals, triggerSettingsRefresh, activeTab, advancedTranslatePaths } from '../store';
import { sanitize } from '../utils/security';
import { buildTranslationRegex, translateText, normalize } from '../utils/translation-engine';

// Sub-components
import DictionaryTable from './translate/DictionaryTable.vue';
import TranslationPane from './translate/TranslationPane.vue';

defineProps<{ theme?: string }>();

const subTab = ref<'dictionary' | 'quick-translate'>('quick-translate');
const dictionaryData = shallowRef<any[]>([]);
const hoveredLineIndex = ref<number | null>(null);
const isLoading = ref(false);
const dictionaryPath = ref('');
const dictionarySearchInput = ref<HTMLInputElement | null>(null);
const localSearchQuery = ref('');

const isStrict = ref(false);

const advancedDictData = ref<Map<string, Map<string, string>>>(new Map());
const advancedDictKeys = ref<string[]>([]);
const sheetCacheMap = new Map<string, { sources: Set<string>, targets: Set<string> }>();

// -- Folder-based Quick Translate ------------------------------
const selectedFolder = ref<string>('');
const excelFilesInFolder = ref<string[]>([]);   // list of .xlsx file paths
const selectedFile = ref<string>('');            // currently selected file in Column 1
const sheetsOfSelectedFile = ref<string[]>([]);  // list of sheets in that file
const selectedSheets = ref<Set<string>>(new Set()); // checked sheets

const fileSheetCounts = ref<Record<string, number>>({}); // Sheet count per file (Column 1)
const sheetRowCounts = ref<Record<string, number>>({});  // Row count per sheet (Column 4)
const sheetMetadata = ref<Record<string, { logical: string, physical: string, colCount: number }>>({}); // Table info

const fileSearchQuery = ref('');
const sheetSearchQuery = ref('');

const filteredFiles = computed(() => {
  if (!fileSearchQuery.value) return excelFilesInFolder.value;
  const q = fileSearchQuery.value.toLowerCase();
  return excelFilesInFolder.value.filter(f => f.toLowerCase().includes(q));
});

const filteredSheets = computed(() => {
  if (!sheetSearchQuery.value) return sheetsOfSelectedFile.value;
  const q = sheetSearchQuery.value.toLowerCase();
  return sheetsOfSelectedFile.value.filter(s => {
    const meta = sheetMetadata.value[s];
    const matchSheet = s.toLowerCase().includes(q);
    const matchLogical = (meta?.logical || '').toLowerCase().includes(q);
    const matchPhysical = (meta?.physical || '').toLowerCase().includes(q);
    return matchSheet || matchLogical || matchPhysical;
  });
});

interface AdvancedConfig {
  sheet: string;
  priority: number;
  enabled: boolean;
}
const advancedConfigs = ref<Record<string, AdvancedConfig>>({});

// Performance optimizations
const debouncedInput = ref(translateInput.value);
let debounceTimer: any = null;
const sourceWordsList = ref<string[]>([]);
const targetWordsList = ref<string[]>([]);

// Optimized Translation Engine State
const cachedLookup = ref<Map<string, string>>(new Map());
const translationRegex = ref<RegExp | null>(null);

// Memoization cache for the Base Dictionary
const baseSourceWords = ref<Set<string>>(new Set());
const baseTargetWords = ref<Set<string>>(new Set());
const baseLookupPart = ref<Map<string, string>>(new Map());

// Copy feedback
const showCopyToast = ref(false);
const copyPos = ref({ x: 0, y: 0 });
const hoveredWord = ref<string | null>(null);

// Modal state
const showDictModal = ref(false);
const modalMode = ref<'add' | 'edit'>('add');
const editingIdx = ref<number | null>(null);
const editBuffer = ref({ jp: '', en: '', vi: '' });

// Refs for components
const paneRef = ref<any>(null);

const maxLines = computed(() => {
  const iLines = translateInput.value.split('\n').length;
  const oLines = translateOutput.value.split('\n').length;
  return Math.max(iLines, oLines, 1);
});

const syncScroll = (side: 'input' | 'result') => {
  if (!paneRef.value) return;
  const source = side === 'input' ? paneRef.value.inputTextarea : paneRef.value.resultTextarea;
  const target = side === 'input' ? paneRef.value.resultTextarea : paneRef.value.inputTextarea;
  const sourceHL = side === 'input' ? paneRef.value.inputHighlighter : paneRef.value.resultHighlighter;
  const targetHL = side === 'input' ? paneRef.value.resultHighlighter : paneRef.value.inputHighlighter;
  const sourceLN = side === 'input' ? paneRef.value.inputLineNumbers : paneRef.value.resultLineNumbers;
  const targetLN = side === 'input' ? paneRef.value.resultLineNumbers : paneRef.value.inputLineNumbers;

  if (!source) return;

  if (sourceHL) {
    sourceHL.scrollTop = source.scrollTop;
    sourceHL.scrollLeft = source.scrollLeft;
  }
  if (sourceLN) {
    sourceLN.scrollTop = source.scrollTop;
  }

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
    dictionaryPath.value = s?.dictionary_path || '';

    if (!dictionaryPath.value) {
      dictionaryData.value = [];
      isLoading.value = false;
      return;
    }

    if (dictionaryPath.value) {
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
      }
    }

    if (s?.advanced_configs) {
      advancedConfigs.value = s.advanced_configs;
    }

    if (s?.quick_translate_folder) {
      selectedFolder.value = s.quick_translate_folder.replace(/\\/g, '/');
      loadFilesFromFolder(selectedFolder.value);
    }

    updateCachedWords();
    handleQuickTranslate();
  } catch (e) {
    console.error('Failed to load dictionaries:', e);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadDictionary();
  window.addEventListener('keydown', handleLocalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleLocalKeyDown);
});

// ... Removed old advanced import methods ...

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
    const aoa = [
      ['JAPANESE', 'ENGLISH', 'VIETNAMESE'],
      ...cleaned.map(item => [item.jp, item.en, item.vi])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dictionary");
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    
    await invoke('write_file_binary', { 
      path: dictionaryPath.value, 
      data: Array.from(new Uint8Array(wbout)) 
    });

    dictionaryData.value = cleaned;
    updateCachedWords();
    alert(`Cleaned successfully! Removed ${removedCount} duplicate rows.`);
  } catch (e) {
    console.error('Failed to clean dictionary:', e);
  }
};

let updateCacheDebounceTimer: any = null;
const updateCachedWords = () => {
  if (updateCacheDebounceTimer) clearTimeout(updateCacheDebounceTimer);
  updateCacheDebounceTimer = setTimeout(() => {
    performUpdateCachedWords();
  }, 100);
};

const rebuildBaseDictionaryCache = () => {
  const sourceSet = new Set<string>();
  const targetSet = new Set<string>();
  const lookup = new Map<string, string>();
  const targetKey = sharedTargetLang.value;

  dictionaryData.value.forEach(d => {
    const tVal = (d[targetKey] || '').toString().trim();
    if (tVal) targetSet.add(tVal);

    ['jp', 'en', 'vi'].forEach(l => {
      if (l !== targetKey) {
        const sVal = (d[l as 'jp'|'en'|'vi'] || '').toString().trim();
        if (sVal) {
          sourceSet.add(sVal);
          if (tVal && sVal !== tVal) lookup.set(sVal, tVal);
        }
      }
    });
  });

  baseSourceWords.value = sourceSet;
  baseTargetWords.value = targetSet;
  baseLookupPart.value = lookup;
};

const performUpdateCachedWords = () => {
  const sourceSet = new Set(baseSourceWords.value);
  const targetSet = new Set(baseTargetWords.value);
  const lookup = new Map(baseLookupPart.value);

  const activeConfigs = Object.entries(advancedConfigs.value)
    .filter(([path, cfg]) => cfg.enabled && cfg.sheet)
    .map(([path, cfg]) => ({ path, ...cfg }))
    .sort((a, b) => a.priority - b.priority);

  if (activeConfigs.length > 0) {
    activeConfigs.forEach(cfg => {
      const mapping = advancedDictData.value.get(cfg.sheet);
      if (mapping) mapping.forEach((val, key) => { if (key && val) lookup.set(key, val); });
      const cache = sheetCacheMap.get(cfg.sheet);
      if (cache) {
        cache.sources.forEach(s => sourceSet.add(s));
        cache.targets.forEach(t => targetSet.add(t));
      }
    });
  }

  sourceWordsList.value = Array.from(sourceSet).sort((a, b) => b.length - a.length);
  targetWordsList.value = Array.from(targetSet).sort((a, b) => b.length - a.length);
  cachedLookup.value = lookup;
  translationRegex.value = buildTranslationRegex(lookup);
  
  updateAllHighlights();
};

const handleQuickTranslate = () => {
  translateOutput.value = translateText(translateInput.value, translationRegex.value, cachedLookup.value);
};

const clearAll = () => {
  translateInput.value = '';
  translateOutput.value = '';
};

const formatInputText = () => {
  let text = translateInput.value;
  if (!text) return;
  if (text.includes('.append(')) {
    const results = text.split('\n').map(line => {
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
  translateInput.value = text.split('\n').map(line => line.trim().replace(/\s+/g, ' ')).filter(line => line.length > 0).join('\n').trim();
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
    try { await invoke('open_file_path', { path: dictionaryPath.value }); } catch (e) { alert('Failed to open Excel file: ' + e); }
  } else {
    alert('Please configure dictionary path in Settings first.');
  }
};

const saveQuickTranslateSettings = async (folder: string) => {
  try {
    const raw = await invoke('get_settings') as string;
    const s = JSON.parse(raw || "{}");
    s.quick_translate_folder = folder;
    await invoke('save_settings', { settings: JSON.stringify(s) });
  } catch (e) {
    console.error('Failed to save Quick Translate settings:', e);
  }
};

const loadFilesFromFolder = async (folderPath: string) => {
  try {
    const files = await invoke('list_files_in_dir', { 
      path: folderPath, 
      extension: 'xlsx' 
    }) as string[];
    excelFilesInFolder.value = files.map(f => f.replace(/\\/g, '/'));
    
    // Scan sheet count for each file (Async to avoid blocking UI)
    fileSheetCounts.value = {};
    for (const f of excelFilesInFolder.value) {
      try {
        const bytes = await invoke('read_file_binary', { path: f }) as number[];
        const workbook = XLSX.read(new Uint8Array(bytes), { type: 'array', bookSheets: true });
        fileSheetCounts.value[f] = workbook.SheetNames.length;
      } catch (err) {
        console.error(`Failed to scan sheets for ${f}:`, err);
      }
    }
  } catch (e) {
    console.error('Failed to load files from folder:', e);
  }
};

// Open folder dialog
const selectFolder = async () => {
  try {
    const folder = await open({ directory: true, multiple: false });
    if (!folder || typeof folder !== 'string') return;
    const cleanPath = folder.replace(/\\/g, '/');
    selectedFolder.value = cleanPath;
    
    await saveQuickTranslateSettings(cleanPath);
    await loadFilesFromFolder(cleanPath);

    selectedFile.value = '';
    sheetsOfSelectedFile.value = [];
    selectedSheets.value = new Set();
  } catch (e) {
    console.error('Failed to select folder:', e);
  }
};

// When clicking a file in Column 1 -> load sheet list into Column 4
const selectExcelFile = async (filePath: string) => {
  selectedFile.value = filePath;
  selectedSheets.value = new Set();
  sheetRowCounts.value = {};
  sheetMetadata.value = {};
  sheetSearchQuery.value = ''; // Reset filter when switching files
  try {
    const bytes = await invoke('read_file_binary', { path: filePath }) as number[];
    const workbook = XLSX.read(new Uint8Array(bytes), { type: 'array' });
    sheetsOfSelectedFile.value = workbook.SheetNames;

    // Calculate metadata for each sheet
    workbook.SheetNames.forEach(name => {
      const ws = workbook.Sheets[name];
      if (!ws) return;

      // Extract metadata according to defined format:
      // Row 2: Table Names
      // Row 5+: Columns
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      let logical = '';
      let physical = '';
      let colCount = 0;

      if (jsonData.length >= 2) {
        const row1 = jsonData[0] || []; // Header row
        const row2 = jsonData[1] || []; // Data row (logical/physical names)

        // Try to find columns for Logical/Physical names
        const lIdx = row1.findIndex((c: any) => String(c||'').includes('論理'));
        const pIdx = row1.findIndex((c: any) => String(c||'').includes('物理'));

        if (lIdx !== -1) logical = String(row2[lIdx] || '').trim();
        else logical = String(row2[0] || '').trim(); // Fallback to first col

        if (pIdx !== -1) physical = String(row2[pIdx] || '').trim();
        else physical = String(row2[3] || row2[1] || '').trim(); // Fallback to col 4 or 2
      }

      // Count columns from row 5 (index 4)
      if (jsonData.length >= 5) {
        for (let i = 4; i < jsonData.length; i++) {
          const row = jsonData[i];
          // A row is counted if it has a number in the first column or content in the logical name column
          if (row && (row[0] !== undefined && row[0] !== '' || row[1])) {
            colCount++;
          }
        }
      }

      sheetMetadata.value[name] = { logical, physical, colCount };
      sheetRowCounts.value[name] = colCount; // Display refined count in Column 4
    });
  } catch (e) {
    console.error('Failed to read sheets:', e);
    sheetsOfSelectedFile.value = [];
  }
};

// When ticking/unticking a sheet in Column 4 -> rebuild lookup
const toggleSheet = async (sheetName: string) => {
  const newSet = new Set(selectedSheets.value);
  if (newSet.has(sheetName)) {
    newSet.delete(sheetName);
  } else {
    newSet.add(sheetName);
    // Load data for this sheet if not already loaded
    const sheetKey = `${selectedFile.value}::${sheetName}`;
    if (!advancedDictData.value.has(sheetKey)) {
      await loadSingleSheet(selectedFile.value, sheetName);
    }
  }
  selectedSheets.value = newSet;
  
  // Sync into advancedConfigs for updateCachedWords() to trigger
  syncFolderSheetsToAdvancedConfigs();
  updateCachedWords();
};

const toggleAllSheets = async () => {
    if (sheetsOfSelectedFile.value.length === 0) return;
    const allChecked = sheetsOfSelectedFile.value.every(s => selectedSheets.value.has(s));
    if (allChecked) {
        selectedSheets.value.clear();
    } else {
        for (const sheetName of sheetsOfSelectedFile.value) {
            if (!selectedSheets.value.has(sheetName)) {
                selectedSheets.value.add(sheetName);
                const sheetKey = `${selectedFile.value}::${sheetName}`;
                if (!advancedDictData.value.has(sheetKey)) {
                    await loadSingleSheet(selectedFile.value, sheetName);
                }
            }
        }
    }
    syncFolderSheetsToAdvancedConfigs();
    updateCachedWords();
};

// Load data for a specific sheet (reusing existing parse logic)
const loadSingleSheet = async (filePath: string, sheetName: string) => {
  try {
    const bytes = await invoke('read_file_binary', { path: filePath }) as number[];
    const workbook = XLSX.read(new Uint8Array(bytes), { type: 'array' });
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    let headerRowIndex = -1, logicalColIdx = -1, physicalColIdx = -1;
    for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
      const row = jsonData[i] || [];
      const li = row.findIndex((c: any) => String(c||'').toLowerCase().includes('論理') || String(c||'').toLowerCase().includes('logical'));
      const pi = row.findIndex((c: any) => String(c||'').toLowerCase().includes('物理') || String(c||'').toLowerCase().includes('physical'));
      if (li !== -1 && pi !== -1) { headerRowIndex = i; logicalColIdx = li; physicalColIdx = pi; break; }
    }

    const mapping = new Map<string, string>();
    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] || [];
        const src = String(row[logicalColIdx]||'').trim();
        const tgt = String(row[physicalColIdx]||'').trim();
        if (src && tgt) mapping.set(src, tgt);
      }
    } else {
      jsonData.forEach(row => {
        if (row.length >= 2) {
          const src = String(row[0]||'').trim(), tgt = String(row[1]||'').trim();
          if (src && tgt && src.length < 200) mapping.set(src, tgt);
        }
      });
    }

    const sheetKey = `${filePath}::${sheetName}`;
    if (mapping.size > 0) {
      advancedDictData.value.set(sheetKey, mapping);
      const ss = new Set<string>(), ts = new Set<string>();
      mapping.forEach((v, k) => { ss.add(k); ts.add(v); });
      sheetCacheMap.set(sheetKey, { sources: ss, targets: ts });
    }
  } catch (e) {
    console.error(`Failed to load sheet ${sheetName}:`, e);
  }
};

// Sync selected sheets into advancedConfigs so updateCachedWords can read them
const syncFolderSheetsToAdvancedConfigs = () => {
  // Remove old config for this file and related sheets in the folder
  const keysToRemove = Object.keys(advancedConfigs.value)
    .filter(k => k.startsWith(selectedFile.value));
  keysToRemove.forEach(k => delete advancedConfigs.value[k]);
  
  if (selectedFile.value && selectedSheets.value.size > 0) {
    let prio = 0;
    selectedSheets.value.forEach(sheetName => {
      const fakeKey = `${selectedFile.value}||${sheetName}`;
      advancedConfigs.value[fakeKey] = {
        sheet: `${selectedFile.value}::${sheetName}`,
        priority: prio++,
        enabled: true
      };
    });
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
  if (target.tagName === 'MARK') copyToClipboard(target.innerText, event);
};

const handleHighlighterMouseOver = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'MARK') hoveredWord.value = target.innerText;
};

const handleHighlighterMouseOut = () => { hoveredWord.value = null; };

const renderHighlighted = (text: string, mode: 'source' | 'target') => {
  if (!text) return '';
  if (text.length > 5000) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const patternArr = mode === 'source' ? sourceWordsList.value : targetWordsList.value;
  if (patternArr.length === 0) return escaped;
  
  const pattern = patternArr.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'g');
  
  return escaped.replace(regex, (match) => {
    const attrMatch = match.replace(/"/g, '&quot;');
    return `<mark class="hl-${mode}" data-word="${attrMatch}">${match}</mark>`;
  });
};

const highlightedInput = ref('');
const highlightedOutput = ref('');
let translateHighlightTimeout: any = null;

const updateAllHighlights = () => {
    highlightedInput.value = renderHighlighted(debouncedInput.value, 'source');
    highlightedOutput.value = renderHighlighted(translateOutput.value, 'target');
};

watch([debouncedInput, translateOutput, activeTab], () => {
    if (translateHighlightTimeout) clearTimeout(translateHighlightTimeout);
    if (activeTab.value !== 'Translate') return;
    translateHighlightTimeout = setTimeout(() => { updateAllHighlights(); }, 400);
}, { immediate: true });

const hoverStyleTag = ref<HTMLStyleElement | null>(null);
watch(hoveredWord, (newWord) => {
  if (!hoverStyleTag.value) {
    hoverStyleTag.value = document.createElement('style');
    document.head.appendChild(hoverStyleTag.value);
  }
  if (newWord && activeTab.value === 'Translate') {
    const escaped = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(newWord) : newWord.replace(/["\\]/g, '\\$&');
    hoverStyleTag.value.innerHTML = `mark[data-word="${escaped}"] { background: var(--accent-color) !important; color: white !important; border-radius: 4px; box-shadow: 0 0 10px var(--accent-color); }`;
  } else {
    hoverStyleTag.value.innerHTML = '';
  }
});

const handleLocalKeyDown = (e: KeyboardEvent) => {
  if (activeTab.value !== 'Translate') return;
  if (e.ctrlKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
    if (subTab.value === 'dictionary') {
      e.preventDefault(); dictionarySearchInput.value?.focus(); dictionarySearchInput.value?.select();
    }
  }
};

watch(translateInput, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debouncedInput.value = val; handleQuickTranslate(); }, 300);
});

watch(translateOutput, async () => {
  await nextTick();
  if (subTab.value === 'quick-translate') syncScroll('result');
});

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
  hoveredLineIndex.value = idx <= maxLines.value ? idx : null;
};

// ...

// CRUD
const openAddModal = () => { modalMode.value = 'add'; editBuffer.value = { jp: '', en: '', vi: '' }; showDictModal.value = true; };
const openEditModal = (item: any) => { modalMode.value = 'edit'; editingIdx.value = dictionaryData.value.indexOf(item); editBuffer.value = { ...item }; showDictModal.value = true; };
const saveModalData = () => {
  const newArr = [...dictionaryData.value];
  if (modalMode.value === 'add') newArr.unshift({ ...editBuffer.value });
  else if (editingIdx.value !== null) newArr[editingIdx.value] = { ...editBuffer.value };
  dictionaryData.value = newArr; showDictModal.value = false;
};

// ...

watch(triggerDictionaryFocus, async () => {
  await nextTick();
  if (dictionarySearchInput.value) { dictionarySearchInput.value.focus(); dictionarySearchInput.value.select(); }
});

watch(dictionaryData, () => {
  rebuildBaseDictionaryCache(); updateCachedWords();
  if (subTab.value === 'quick-translate' && translateInput.value) handleQuickTranslate();
});
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
        <button v-if="subTab === 'dictionary'" @click="cleanDictionaryDuplicates" class="action-btn-danger">CLEAN DUPLICATES</button>
      </div>
    </header>

    <div class="tab-body">
      <DictionaryTable 
        v-if="subTab === 'dictionary'"
        :data="dictionaryData"
        :isLoading="isLoading"
        :searchQuery="localSearchQuery"
        :isStrict="isStrict"
        :dictionaryPath="dictionaryPath"
        @edit="openEditModal"
        @delete="(item) => dictionaryData = dictionaryData.filter(i => i !== item)"
        @copy="copyToClipboard"
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
        :maxLines="maxLines"
        :activeSourcesCount="Object.values(advancedConfigs).filter(c => c.enabled && c.sheet).length"
        @format="formatInputText"
        @clear="clearAll"
        @copy="copyResult"
        @scroll="syncScroll"
        @highlighterClick="handleHighlighterClick"
        @highlighterMouseOver="handleHighlighterMouseOver"
        @highlighterMouseOut="handleHighlighterMouseOut"
        @mouseMove="handleEditorMouseMove"
        :folderPath="selectedFolder"
        :excelFiles="filteredFiles"
        :selectedFile="selectedFile"
        :sheets="filteredSheets"
        :selectedSheets="selectedSheets"
        :fileSheetCounts="fileSheetCounts"
        :sheetRowCounts="sheetRowCounts"
        :sheetMetadata="sheetMetadata"
        v-model:fileSearch="fileSearchQuery"
        v-model:sheetSearch="sheetSearchQuery"
        @selectFolder="selectFolder"
        @selectFile="selectExcelFile"
        @toggleSheet="toggleSheet"
        @toggleAllSheets="toggleAllSheets"
      />
    </div>

    <!-- Modals -->
    <!-- Old Advanced Modal Removed -->

    <div v-if="showDictModal" class="modal-overlay">
      <div class="modal-content glass-modal">
        <div class="modal-header-modern">
          <h3>{{ modalMode === 'add' ? 'ADD NEW ENTRY' : 'EDIT ENTRY' }}</h3>
          <button @click="showDictModal = false" class="close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
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

    <!-- Feedback Toast -->
    <transition name="bubble">
      <div v-if="showCopyToast" class="copy-bubble" :style="{ left: copyPos.x + 'px', top: (copyPos.y - 30) + 'px' }">Copied!</div>
    </transition>
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
.header-search-input { flex: 1; background: transparent; border: none; color: #6366f1; font-weight: 800; font-size: 0.8rem; outline: none; }
.strict-mode { display: flex; align-items: center; gap: 5px; font-size: 0.6rem; font-weight: 900; opacity: 0.5; color: var(--text-color); cursor: pointer; }
.global-actions { display: flex; gap: 10px; }
.action-btn-mint { padding: 8px 15px; background: #ecfdf5; color: #10b981; border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
.action-btn-danger { padding: 8px 15px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
.action-btn-purple { padding: 8px 15px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
.tab-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.glass-modal { background: var(--container-bg); border: 1px solid var(--accent-color); border-radius: 16px; width: 420px; padding: 25px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); color: var(--text-color); }
.modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px; }
.modal-field input { background: var(--bg-color); border: 1px solid rgba(128,128,128,0.2); border-radius: 10px; padding: 12px; color: var(--text-color); font-size: 0.85rem; outline: none; }
.advanced-modal { width: 850px; max-width: 95vw; background: var(--container-bg); border-radius: 16px; border: 1px solid var(--accent-color); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
.modal-header { padding: 15px 20px; background: rgba(128,128,128,0.05); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(128,128,128,0.1); }
.modal-header span { font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; color: var(--accent-color); }
.close-btn { background: transparent; border: none; color: var(--text-color); font-size: 1.5rem; cursor: pointer; opacity: 0.5; }
.close-btn:hover { opacity: 1; }

.modal-body { padding: 20px; overflow-y: auto; max-height: 70vh; }
.modal-info { font-size: 0.75rem; opacity: 0.6; margin-bottom: 20px; line-height: 1.4; }
.modal-info b { color: var(--accent-color); }

.advanced-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.advanced-row { display: grid; grid-template-columns: 1.2fr 1fr 180px; align-items: center; gap: 15px; background: rgba(128, 128, 128, 0.04); border: 1px solid rgba(128, 128, 128, 0.1); border-radius: 10px; padding: 8px 15px; transition: 0.2s; }
.advanced-row:hover { background: rgba(128, 128, 128, 0.08); border-color: rgba(99, 102, 241, 0.3); }
.advanced-row.is-active { border-color: rgba(99, 102, 241, 0.5); background: rgba(99, 102, 241, 0.03); }

.row-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.selection-check input { width: 16px; height: 16px; cursor: pointer; }
.file-info { min-width: 0; }
.file-name { font-size: 0.8rem; font-weight: 800; color: var(--text-color); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-path { font-size: 0.6rem; opacity: 0.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.row-middle { display: flex; align-items: center; justify-content: center; }
.sheet-dropdown { width: 100%; position: relative; }
.dropdown-trigger { background: var(--bg-color); border: 1px solid rgba(128,128,128,0.2); padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; text-align: center; color: var(--text-color); transition: 0.2s; }
.dropdown-trigger:hover { border-color: var(--accent-color); }
.dropdown-trigger.compact { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.floating-dropdown-menu { position: absolute; z-index: 99999; background: var(--container-bg); border: 1px solid var(--accent-color); border-radius: 12px; padding: 10px; margin-top: 5px; box-shadow: 0 15px 40px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 8px; }
.dropdown-search { background: rgba(128,128,128,0.1); border: 1px solid rgba(128,128,128,0.1); border-radius: 6px; padding: 5px 10px; font-size: 0.7rem; color: var(--text-color); outline: none; }
.dropdown-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.dropdown-item { padding: 6px 10px; font-size: 0.7rem; border-radius: 6px; cursor: pointer; transition: 0.2s; color: var(--text-color); }
.dropdown-item:hover { background: rgba(99, 102, 241, 0.1); color: var(--accent-color); }
.dropdown-item.active { background: var(--accent-color); color: white; }

.row-right { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.priority-dashboard { display: flex; align-items: center; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 2px; }
.prio-mini-btn { width: 24px; height: 24px; border: none; background: transparent; color: var(--text-color); cursor: pointer; border-radius: 4px; font-weight: bold; }
.prio-mini-btn:hover { background: rgba(255,255,255,0.1); }
.prio-mini-input { width: 30px; background: transparent; border: none; text-align: center; color: var(--accent-color); font-size: 0.75rem; font-weight: 900; -moz-appearance: textfield; }
.prio-mini-input::-webkit-outer-spin-button, .prio-mini-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.remove-mini-btn { background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); padding: 5px; border-radius: 6px; cursor: pointer; transition: 0.2s; display: flex; }
.remove-mini-btn:hover { background: #f43f5e; color: white; }

.manual-add-row { display: flex; gap: 10px; margin-top: 10px; }
.path-input-field { flex: 1; background: rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); border-radius: 8px; padding: 8px 12px; color: var(--text-color); font-size: 0.75rem; outline: none; }
.path-input-field:focus { border-color: var(--accent-color); }
.add-manual-btn { background: var(--accent-color); color: white; border: none; border-radius: 8px; padding: 0 15px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: opacity 0.2s; }
.browse-fab { background: rgba(128,128,128,0.1); border: 1px solid rgba(128,128,128,0.1); border-radius: 8px; padding: 0 12px; cursor: pointer; font-size: 1rem; }
.modal-error { font-size: 0.65rem; color: #f43f5e; margin-top: 5px; font-weight: bold; }
.copy-bubble { position: fixed; background: #10b981; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 0.65rem; font-weight: 900; z-index: 3000; transform: translateX(-50%); }
.bubble-enter-active, .bubble-leave-active { transition: all 0.2s ease; }
.bubble-enter-from { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
.bubble-leave-to { opacity: 0; transform: translate(-50%, -10px) scale(0.8); }
</style>
