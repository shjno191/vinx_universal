import { ref, shallowRef, watch, nextTick } from 'vue';
import * as XLSX from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import {
  translateInput,
  translateOutput,
  sharedTargetLang,
  useFileSystem,
  useGlobalLoading
} from '@vinx/sdk';
import { buildTranslationRegex, translateText } from './translation-engine';
import { parseTechnicalSheet, extractSheetMetadata } from './sheet-parser';

export interface AdvancedConfig {
  sheet: string;
  priority: number;
  enabled: boolean;
}

// --- Global Shared State (Singleton) ---
const subTab = ref<'dictionary' | 'quick-translate'>('quick-translate');
const dictionaryData = shallowRef<any[]>([]);
const isLoading = ref(false);
const dictionaryPath = ref('');
const localSearchQuery = ref('');

const isOnlySelectedSheets = ref(false);
const isStrict = ref(false);

const advancedDictData = shallowRef<Map<string, Map<string, string>>>(new Map());
const advancedConfigs = ref<Record<string, AdvancedConfig>>({});

const selectedFolder = ref<string>('');
const excelFilesInFolder = shallowRef<string[]>([]);
const selectedFiles = ref<Set<string>>(new Set());
const fileSheetsData = shallowRef<Map<string, string[]>>(new Map());
const selectedSheets = ref<Set<string>>(new Set());

const fileSheetCounts = shallowRef<Record<string, number>>({});
const sheetRowCounts = shallowRef<Record<string, number>>({});
const sheetMetadata = shallowRef<Record<string, { logical: string, physical: string, rowCount: number }>>({});

const fileSearchQuery = ref('');
const sheetSearchQuery = ref('');

let loadingCount = 0;
let loadingTimer: any = null;

const { globalLoading: loadingState } = useGlobalLoading();

export function useTranslateManager() {
  const { readBinary } = useFileSystem();
  const { showLoading, hideLoading, updateProgress } = useGlobalLoading();

  const startLoading = (msg: string) => {
    loadingCount++;
    showLoading(msg);
  };

  const stopLoading = () => {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
      if (loadingTimer) clearTimeout(loadingTimer);
      loadingTimer = null;
      hideLoading();
    }
  };

  // Translation Engine State
  const debouncedInput = ref(translateInput.value);
  const cachedLookup = shallowRef<Map<string, string>>(new Map());
  const translationRegex = shallowRef<RegExp | null>(null);
  const sourceWordsList = shallowRef<string[]>([]);
  const targetWordsList = shallowRef<string[]>([]);

  // Base Dictionary Memoization - Using shallowRef for heavy sets/maps
  const baseSourceWords = shallowRef<Set<string>>(new Set());
  const baseTargetWords = shallowRef<Set<string>>(new Set());
  const baseLookupPart = shallowRef<Map<string, string>>(new Map());

  // --- Internal Helpers ---

  const detectLanguageAndSetTarget = (text: string) => {
    if (!text || text.trim().length === 0) return;
    
    // Check if it contains Japanese characters (Hiragana, Katakana, Kanji)
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    
    if (hasJapanese) {
      // Input contains Japanese -> Target should be English
      if (sharedTargetLang.value !== 'en') {
        console.log('[TranslateManager] Auto-detected Japanese input, setting target to English');
        sharedTargetLang.value = 'en';
      }
    } else {
      // Check if it contains English/Latin characters
      const hasLatin = /[a-zA-Z]/.test(text);
      if (hasLatin) {
        // Input is likely English -> Target should be Japanese
        if (sharedTargetLang.value !== 'jp') {
          console.log('[TranslateManager] Auto-detected English input, setting target to Japanese');
          sharedTargetLang.value = 'jp';
        }
      }
    }
  };

  let translateDebounceTimer: any = null;
  const triggerDebouncedTranslate = () => {
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    translateDebounceTimer = setTimeout(() => {
      detectLanguageAndSetTarget(translateInput.value);
      debouncedInput.value = translateInput.value;
      performQuickTranslate();
    }, 350);
  };

  // Watch for input changes to trigger translation
  watch(translateInput, triggerDebouncedTranslate, { immediate: true });

  // --- Core Methods ---

  const loadDictionary = async (path: string) => {
    try {
      if (typeof path !== 'string') {
        console.error('[TranslateManager] Dictionary path is not a string:', path);
        return null;
      }
      const cleanPath = path.trim();
      if (!cleanPath) return null;

      isLoading.value = true;
      console.log(`[TranslateManager] Loading dictionary: ${cleanPath}`);

      startLoading('Parsing dictionary entries...');
      // Give UI a chance to show the modal before the main thread gets busy reading binary
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      const b64 = await readBinary(cleanPath);
      if (!b64 || b64.length === 0) {
        throw new Error('Dictionary file is empty or could not be read');
      }
      const workbook = XLSX.read(b64, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        const rawRows = jsonData.slice(1)
          .map(row => ({
            jp: (row[0] || '').toString().trim(),
            en: (row[1] || '').toString().trim(),
            vi: (row[2] || '').toString().trim()
          }))
          .filter(row => row.jp !== '' || row.en !== '' || row.vi !== '');

        // Deduplicate based on JP and EN columns (2 first columns)
        const totalRows = rawRows.length;
        const finalRows: any[] = [];
        const uniqueMap = new Map();

        for (const [idx, row] of rawRows.entries()) {
          const key = `${row.jp}|${row.en}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, row);
            finalRows.push(row);
          }
          if (idx % 1000 === 0) {
            updateProgress(Math.round((idx / totalRows) * 100));
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        const removedCount = rawRows.length - finalRows.length;

        console.log(`[TranslateManager] Loaded ${rawRows.length} total, filtered ${removedCount} duplicates. Final: ${finalRows.length} entries.`);

        dictionaryData.value = finalRows;
        rebuildBaseDictionaryCache();
        updateCachedWords();

        return { total: rawRows.length, removed: removedCount, final: finalRows.length };
      } else {
        console.warn('[TranslateManager] Dictionary file is empty');
        return { total: 0, removed: 0, final: 0 };
      }
    } catch (error) {
      console.error(`[TranslateManager] Failed to load dictionary:`, error);
      dictionaryData.value = [];
      return null;
    } finally {
      isLoading.value = false;
      stopLoading();
    }
  };

  const saveDictionaryFile = async (path: string, entries: any[]) => {
    try {
      if (!path) return;
      console.log(`[TranslateManager] Saving dictionary to: ${path}`);

      const data = [
        ['Japanese (JP)', 'English (EN)', 'Vietnamese (VI)'],
        ...entries.map(e => [e.jp, e.en, e.vi])
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dictionary');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const uint8 = new Uint8Array(wbout);

      await invoke('write_file_binary', {
        path,
        data: Array.from(uint8)
      });
      console.log('[TranslateManager] Dictionary saved successfully');
    } catch (error) {
      console.error('[TranslateManager] Failed to save dictionary:', error);
      throw error;
    }
  };

  const loadFilesFromMultipleFolders = async (folders: string[]) => {
    if (!folders || folders.length === 0) {
      excelFilesInFolder.value = [];
      fileSheetCounts.value = {};
      fileSheetsData.value = new Map();
      return;
    }

    console.log(`[TranslateManager] Syncing files from ${folders.length} folders:`, folders);
    startLoading('Scanning Excel folders...');

    // Give UI a chance to show the modal
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const allFiles: string[] = [];
      for (const folder of folders) {
        try {
          const files = await invoke('list_files_in_dir', { path: folder, extension: 'xlsx' }) as string[];
          console.log(`[TranslateManager] Folder ${folder} has ${files.length} files`);
          const normalized = files.map(f => String(f).replace(/\\/g, '/'));
          allFiles.push(...normalized);
        } catch (dirErr) {
          console.warn(`[TranslateManager] Skip folder ${folder}:`, dirErr);
        }
      }

      // Remove duplicates
      const uniqueFiles = [...new Set(allFiles)];
      excelFilesInFolder.value = uniqueFiles;
      console.log(`[TranslateManager] Total unique files found: ${uniqueFiles.length}`);

      const totalItems = excelFilesInFolder.value.length;
      let processed = 0;
      const newSheetCounts: Record<string, number> = {};
      const newFileSheets = new Map<string, string[]>();
      const newMetadata = { ...sheetMetadata.value };
      const newRowCounts = { ...sheetRowCounts.value };

      for (const f of excelFilesInFolder.value) {
        try {
          processed++;
          const progressMsg = `Analyzing file: ${processed}/${totalItems} (${f.split(/[/\\]/).pop()})`;
          showLoading(progressMsg);
          updateProgress(Math.round(((processed - 0.5) / totalItems) * 100));
          await new Promise(resolve => setTimeout(resolve, 0));

          const b64 = await readBinary(f);
          const workbook = XLSX.read(b64, { type: 'array' });

          newSheetCounts[f] = workbook.SheetNames.length;
          newFileSheets.set(f, workbook.SheetNames);

          workbook.SheetNames.forEach(name => {
            const meta = extractSheetMetadata(workbook.Sheets[name]);
            const key = `${f}::${name}`;
            newMetadata[key] = meta;
            newRowCounts[key] = meta.rowCount;
          });

          updateProgress(Math.round((processed / totalItems) * 100));
          // Yield to UI thread
          await new Promise(resolve => setTimeout(resolve, 0));
        } catch (err) {
          console.error(`[TranslateManager] Failed to scan contents for ${f}:`, err);
        }
      }
      fileSheetCounts.value = newSheetCounts;
      fileSheetsData.value = newFileSheets;
      sheetMetadata.value = newMetadata;
      sheetRowCounts.value = newRowCounts;
    } catch (e) {
      console.error('[TranslateManager] Failed to load files from folders:', e);
    } finally {
      stopLoading();
    }
  };

  const loadFilesFromFolder = async (folderPath: string) => {
    await loadFilesFromMultipleFolders([folderPath]);
  };

  const selectExcelFile = async (filePath: string) => {
    if (!fileSheetsData.value.has(filePath)) {
      try {
        const b64 = await readBinary(filePath);
        const workbook = XLSX.read(b64, { type: 'array' });

        const newFileSheets = new Map(fileSheetsData.value);
        newFileSheets.set(filePath, workbook.SheetNames);
        fileSheetsData.value = newFileSheets;

        const newMetadata = { ...sheetMetadata.value };
        const newRowCounts = { ...sheetRowCounts.value };

        workbook.SheetNames.forEach(name => {
          const metadata = extractSheetMetadata(workbook.Sheets[name]);
          newMetadata[`${filePath}::${name}`] = metadata;
          newRowCounts[`${filePath}::${name}`] = metadata.rowCount;
        });

        sheetMetadata.value = newMetadata;
        sheetRowCounts.value = newRowCounts;
      } catch (e) {
        console.error('[TranslateManager] Failed to read sheets:', e);
      }
    }
  };

  const toggleExcelFile = async (filePath: string) => {
    if (selectedFiles.value.has(filePath)) {
      selectedFiles.value.delete(filePath);
      // Automatically deselect all sheets of this file
      const newSelectedSheets = new Set(selectedSheets.value);
      for (const s of newSelectedSheets) {
        if (s.startsWith(`${filePath}::`)) {
          newSelectedSheets.delete(s);
        }
      }
      selectedSheets.value = newSelectedSheets;
    } else {
      selectedFiles.value.add(filePath);
      await selectExcelFile(filePath);
    }
    updateCachedWords();
  };

  const loadSingleSheet = async (filePath: string, sheetName: string) => {
    const sheetKey = `${filePath}::${sheetName}`;
    if (advancedDictData.value.has(sheetKey)) return;

    try {
      startLoading(`Loading sheet: ${sheetName}...`);
      const b64 = await readBinary(filePath);
      const workbook = XLSX.read(b64, { type: 'array' });
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const mapping = parseTechnicalSheet(worksheet);
      if (mapping && mapping.size > 0) {
        console.log(`[TranslateManager] Loaded ${mapping.size} mappings from sheet: ${sheetName}`);
        const newMap = new Map(advancedDictData.value);
        newMap.set(sheetKey, mapping);
        advancedDictData.value = newMap;
      }
    } finally {
      stopLoading();
    }
  };

  const rebuildBaseDictionaryCache = () => {
    const sourceSet = new Set<string>();
    const targetSet = new Set<string>();
    const lookup = new Map<string, string>();
    const targetKey = sharedTargetLang.value as 'jp' | 'en' | 'vi';

    dictionaryData.value.forEach(d => {
      const tVal = (d[targetKey] || '').toString().trim();

      // We want to map EVERYTHING ELSE to tVal
      ['jp', 'en', 'vi'].forEach(l => {
        const sVal = (d[l as 'jp' | 'en' | 'vi'] || '').toString().trim();
        if (sVal && sVal !== tVal) {
          // Add mapping from sVal to tVal
          lookup.set(sVal, tVal);
          sourceSet.add(sVal);
        }
      });

      // Also ensure target itself is in targetSet for highlighting
      if (tVal) targetSet.add(tVal);
    });

    baseSourceWords.value = sourceSet;
    baseTargetWords.value = targetSet;
    baseLookupPart.value = lookup;
  };

  const updateCachedWords = () => {
    const sourceSet = new Set<string>();
    const targetSet = new Set<string>();
    const lookup = new Map<string, string>();

    // Helper to add word mapping with direction awareness
    const addToLookup = (logical: string, physical: string) => {
      if (!logical || !physical) return;
      let source = '';
      let target = '';

      if (sharedTargetLang.value === 'jp') {
        source = physical;
        target = logical;
      } else if (sharedTargetLang.value === 'en') {
        source = logical;
        target = physical;
      } else if (sharedTargetLang.value === 'vi') {
        sourceSet.add(logical);
        sourceSet.add(physical);
        return;
      }

      if (source && target && !lookup.has(source)) {
        lookup.set(source, target);
        sourceSet.add(source);
        targetSet.add(target);
      }
    };

    // 1. Process Selected Sheets first (Insertion order = "First selected wins")
    selectedSheets.value.forEach(fullKey => {
      // 1.1 Add Table/Sheet Name from Metadata
      const meta = sheetMetadata.value[fullKey];
      if (meta) {
        addToLookup(meta.logical, meta.physical);
      }

      // 1.2 Add Columns mappings
      const mapping = advancedDictData.value.get(fullKey);
      if (mapping) {
        mapping.forEach((physical, logical) => addToLookup(logical, physical));
      }
    });

    // 2. Process Base Dictionary last (if not in ONLY mode)
    if (!isOnlySelectedSheets.value) {
      baseLookupPart.value.forEach((target, source) => {
        if (!lookup.has(source)) {
          lookup.set(source, target);
          sourceSet.add(source);
          targetSet.add(target);
        }
      });
      baseTargetWords.value.forEach(word => targetSet.add(word));
    }

    sourceWordsList.value = Array.from(sourceSet).sort((a, b) => b.length - a.length);
    targetWordsList.value = Array.from(targetSet).sort((a, b) => b.length - a.length);
    cachedLookup.value = lookup;
    translationRegex.value = buildTranslationRegex(lookup);

    performQuickTranslate();
  };

  const performQuickTranslate = () => {
    translateOutput.value = translateText(translateInput.value, translationRegex.value, cachedLookup.value);
  };

  const simulateLoading = async (durationMs: number = 5000) => {
    startLoading('Simulating Data Processing...');
    
    const setProgress = (p: number) => {
      updateProgress(p);
    };
    
    const steps = 100;
    const interval = durationMs / steps;

    for (let i = 0; i <= steps; i++) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    setTimeout(() => {
      loadingState.value.show = false;
    }, 500);
  };

  return {
    subTab,
    dictionaryData,
    isLoading,
    dictionaryPath,
    localSearchQuery,
    isOnlySelectedSheets,
    isStrict,
    advancedConfigs,
    selectedFolder,
    excelFilesInFolder,
    selectedFiles,
    fileSheetsData,
    selectedSheets,
    fileSheetCounts,
    sheetRowCounts,
    sheetMetadata,
    globalLoading: loadingState,
    fileSearchQuery,
    sheetSearchQuery,
    debouncedInput,
    translationRegex,
    cachedLookup,
    sourceWordsList,
    targetWordsList,
    startLoading,
    stopLoading,
    loadDictionary,
    loadFilesFromMultipleFolders,

    loadFilesFromFolder,
    selectExcelFile,
    toggleExcelFile,
    loadSingleSheet,
    updateCachedWords,
    performQuickTranslate,
    rebuildBaseDictionaryCache,
    saveDictionaryFile,
    simulateLoading
  };
}
