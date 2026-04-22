import { ref, shallowRef, watch, nextTick } from 'vue';
import * as XLSX from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import { 
  translateInput, 
  translateOutput, 
  sharedTargetLang, 
  activeTab 
} from '../store';
import { buildTranslationRegex, translateText } from '../utils/translation-engine';
import { parseTechnicalSheet, extractSheetMetadata } from '../utils/sheet-parser';
import { useFileSystem } from './useFileSystem';

export interface AdvancedConfig {
  sheet: string;
  priority: number;
  enabled: boolean;
}

export function useTranslateManager() {
  const { readBinary } = useFileSystem();

  // --- State ---
  const subTab = ref<'dictionary' | 'quick-translate'>('quick-translate');
  const dictionaryData = shallowRef<any[]>([]);
  const isLoading = ref(false);
  const dictionaryPath = ref('');
  const localSearchQuery = ref('');
  
  const isOnlySelectedSheets = ref(false);
  const isStrict = ref(false);

  // Advanced Dictionary Data - shallowRef for performance
  const advancedDictData = shallowRef<Map<string, Map<string, string>>>(new Map());
  const advancedConfigs = ref<Record<string, AdvancedConfig>>({});

  // Quick Translate Folder State
  const selectedFolder = ref<string>('');
  const excelFilesInFolder = shallowRef<string[]>([]);
  const selectedFile = ref<string>('');
  const sheetsOfSelectedFile = shallowRef<string[]>([]);
  const selectedSheets = ref<Set<string>>(new Set());

  // Metrics and Metadata
  const fileSheetCounts = shallowRef<Record<string, number>>({});
  const sheetRowCounts = shallowRef<Record<string, number>>({});
  const sheetMetadata = shallowRef<Record<string, { logical: string, physical: string, colCount: number }>>({});

  // Search/Filters
  const fileSearchQuery = ref('');
  const sheetSearchQuery = ref('');

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

  let translateDebounceTimer: any = null;
  const triggerDebouncedTranslate = () => {
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    translateDebounceTimer = setTimeout(() => {
      debouncedInput.value = translateInput.value;
      performQuickTranslate();
    }, 350);
  };

  // Watch for input changes to trigger translation
  watch(translateInput, triggerDebouncedTranslate);

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
        const uniqueMap = new Map();
        rawRows.forEach(row => {
          const key = `${row.jp}|${row.en}`;
          uniqueMap.set(key, row); // Keep the last occurrence
        });
        
        const finalRows = Array.from(uniqueMap.values());
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
      if (path) {
        console.error(`[TranslateManager] Failed to load dictionary From path "${path}":`, error);
      } else {
        console.error(`[TranslateManager] Failed to load dictionary (null path):`, error);
      }
      dictionaryData.value = [];
      return null;
    } finally {
      isLoading.value = false;
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

  const loadFilesFromFolder = async (folderPath: string) => {
    try {
      const files = await invoke('list_files_in_dir', { path: folderPath, extension: 'xlsx' }) as string[];
      excelFilesInFolder.value = files.map(f => {
        if (typeof f !== 'string') return String(f);
        return f.replace(/\\/g, '/');
      });
      
      const newSheetCounts: Record<string, number> = {};
      for (const f of excelFilesInFolder.value) {
        try {
          const b64 = await readBinary(f);
          const workbook = XLSX.read(b64, { type: 'array', bookSheets: true });
          newSheetCounts[f] = workbook.SheetNames.length;
        } catch (err) {
          console.error(`[TranslateManager] Failed to scan sheets for ${f}:`, err);
        }
      }
      fileSheetCounts.value = newSheetCounts;
    } catch (e) {
      console.error('[TranslateManager] Failed to load files from folder:', e);
    }
  };

  const selectExcelFile = async (filePath: string) => {
    selectedFile.value = filePath;
    selectedSheets.value = new Set();
    sheetRowCounts.value = {};
    sheetMetadata.value = {};
    sheetSearchQuery.value = '';
    try {
      const b64 = await readBinary(filePath);
      const workbook = XLSX.read(b64, { type: 'array' });
      sheetsOfSelectedFile.value = workbook.SheetNames;

      const newMetadata: Record<string, any> = {};
      const newRowCounts: Record<string, number> = {};
      
      workbook.SheetNames.forEach(name => {
        const metadata = extractSheetMetadata(workbook.Sheets[name]);
        newMetadata[name] = metadata;
        newRowCounts[name] = metadata.colCount;
      });
      
      sheetMetadata.value = newMetadata;
      sheetRowCounts.value = newRowCounts;
    } catch (e) {
      console.error('[TranslateManager] Failed to read sheets:', e);
      sheetsOfSelectedFile.value = [];
    }
  };

  const loadSingleSheet = async (filePath: string, sheetName: string) => {
    try {
      const b64 = await readBinary(filePath);
      const workbook = XLSX.read(b64, { type: 'array' });
      const mapping = parseTechnicalSheet(workbook.Sheets[sheetName]);
      const sheetKey = `${filePath}::${sheetName}`;
      if (mapping && mapping.size > 0) {
        console.log(`[TranslateManager] Loaded ${mapping.size} mappings from sheet: ${sheetName}`);
        const newMap = new Map(advancedDictData.value);
        newMap.set(sheetKey, mapping);
        advancedDictData.value = newMap;
      } else {
        console.warn(`[TranslateManager] No valid mappings found in sheet: ${sheetName}`);
      }
    } catch (e) {
      console.error(`[TranslateManager] Failed to load sheet ${sheetName}:`, e);
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
    const activeConfigs = Object.entries(advancedConfigs.value)
      .filter(([_, cfg]) => cfg.enabled && cfg.sheet)
      .map(([path, cfg]) => ({ path, ...cfg }))
      .sort((a, b) => a.priority - b.priority);

    let sourceSet: Set<string>;
    let targetSet: Set<string>;
    let lookup: Map<string, string>;

    if (activeConfigs.length === 0) {
      sourceSet = new Set(baseSourceWords.value);
      targetSet = new Set(baseTargetWords.value);
      lookup = new Map(baseLookupPart.value);
    } else {
      sourceSet = isOnlySelectedSheets.value ? new Set() : new Set(baseSourceWords.value);
      targetSet = isOnlySelectedSheets.value ? new Set() : new Set(baseTargetWords.value);
      lookup = isOnlySelectedSheets.value ? new Map() : new Map(baseLookupPart.value);

      activeConfigs.forEach(cfg => {
        const mapping = advancedDictData.value.get(cfg.sheet);
        if (mapping) {
          mapping.forEach((physical, logical) => {
            if (!logical || !physical) return;
            if (sharedTargetLang.value === 'jp') {
              // Target is JP: map from Physical (EN) to Logical (JP)
              lookup.set(physical, logical);
              sourceSet.add(physical);
              targetSet.add(logical);
            } else if (sharedTargetLang.value === 'en') {
              // Target is EN: map from Logical (JP) to Physical (EN)
              lookup.set(logical, physical);
              sourceSet.add(logical);
              targetSet.add(physical);
            } else if (sharedTargetLang.value === 'vi') {
              // For VI, technical sheets (JP/EN) usually don't have direct VI columns.
              // We rely on the base dictionary for JP->VI or EN->VI.
              // But we can add JP->EN as a fallback if desired, though usually not.
              // Let's at least add them to source/target sets for highlighting.
              sourceSet.add(logical);
              sourceSet.add(physical);
            }
          });
        }
      });
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
    selectedFile,
    sheetsOfSelectedFile,
    selectedSheets,
    fileSheetCounts,
    sheetRowCounts,
    sheetMetadata,
    fileSearchQuery,
    sheetSearchQuery,
    debouncedInput,
    translationRegex,
    cachedLookup,
    sourceWordsList,
    targetWordsList,
    loadDictionary,
    loadFilesFromFolder,
    selectExcelFile,
    loadSingleSheet,
    updateCachedWords,
    performQuickTranslate,
    rebuildBaseDictionaryCache,
    saveDictionaryFile
  };
}
