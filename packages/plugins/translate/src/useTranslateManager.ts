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
import { useCacheManager } from './utils/cache-manager';

export interface WordSourceInfo {
  type: 'base' | 'tech' | 'composed';
  source?: string; // e.g., filename or sheet name
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

const wordSourceMap = shallowRef<Map<string, WordSourceInfo>>(new Map());

let loadingCount = 0;
let loadingTimer: any = null;

const { globalLoading: loadingState } = useGlobalLoading();

export function useTranslateManager() {
  const { readBinary } = useFileSystem();
  const { loadCache, saveCache } = useCacheManager();
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
  const wordSourceMapLocal = wordSourceMap; // Just a reference for convenience

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

  const loadDictionary = async (path: string, forceRefresh = false) => {
    try {
      if (typeof path !== 'string') {
        console.error('[TranslateManager] Dictionary path is not a string:', path);
        return null;
      }
      const cleanPath = path.trim();
      if (!cleanPath) return null;

      isLoading.value = true;
      console.log(`[TranslateManager] Loading dictionary: ${cleanPath} (force: ${forceRefresh})`);

      startLoading('Parsing dictionary entries...');
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      let jsonData: any[][] = [];

      // Try cache first
      const cachedData = forceRefresh ? null : await loadCache(cleanPath);
      if (cachedData && Array.isArray(cachedData.rows)) {
        console.log(`[TranslateManager] Loaded dictionary from cache: ${cleanPath}`);
        jsonData = cachedData.rows;
      } else {
        const b64 = await readBinary(cleanPath);
        if (!b64 || b64.length === 0) {
          throw new Error('Dictionary file is empty or could not be read');
        }
        const workbook = XLSX.read(b64, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Save to cache
        await saveCache(cleanPath, { rows: jsonData });
      }

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
      
      // Also update the JSON cache to keep it in sync
      await saveCache(path, { rows: data });
    } catch (error) {
      console.error('[TranslateManager] Failed to save dictionary:', error);
      throw error;
    }
  };

  const loadFilesFromMultipleFolders = async (folders: string[], forceRefresh = false) => {
    if (!folders || folders.length === 0) {
      excelFilesInFolder.value = [];
      fileSheetCounts.value = {};
      fileSheetsData.value = new Map();
      return;
    }

    console.log(`[TranslateManager] Syncing files from ${folders.length} folders (force: ${forceRefresh}):`, folders);
    startLoading('Scanning Excel folders...');

    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const allFiles: string[] = [];
      for (const folder of folders) {
        try {
          const files = await invoke('list_files_in_dir', { path: folder, extension: 'xlsx' }) as string[];
          const normalized = files.map(f => String(f).replace(/\\/g, '/'));
          allFiles.push(...normalized);
        } catch (dirErr) {
          console.warn(`[TranslateManager] Skip folder ${folder}:`, dirErr);
        }
      }

      const uniqueFiles = [...new Set(allFiles)];
      excelFilesInFolder.value = uniqueFiles;

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

          // Try cache first
          const cached = forceRefresh ? null : await loadCache(f);
          if (cached && cached.sheetNames && cached.sheetMetadata) {
            console.log(`[TranslateManager] Loaded file info from cache: ${f}`);
            newSheetCounts[f] = cached.sheetNames.length;
            newFileSheets.set(f, cached.sheetNames);
            Object.keys(cached.sheetMetadata).forEach(sheetName => {
              const key = `${f}::${sheetName}`;
              newMetadata[key] = cached.sheetMetadata[sheetName];
              newRowCounts[key] = cached.sheetMetadata[sheetName].rowCount;
            });
          } else {
            const b64 = await readBinary(f);
            const workbook = XLSX.read(b64, { type: 'array' });

            newSheetCounts[f] = workbook.SheetNames.length;
            newFileSheets.set(f, workbook.SheetNames);

            const fileMetadata: Record<string, any> = {};
            workbook.SheetNames.forEach(name => {
              const meta = extractSheetMetadata(workbook.Sheets[name]);
              const key = `${f}::${name}`;
              newMetadata[key] = meta;
              newRowCounts[key] = meta.rowCount;
              fileMetadata[name] = meta;
            });

            // Save to cache (initial scan only saves metadata)
            await saveCache(f, {
              sheetNames: workbook.SheetNames,
              sheetMetadata: fileMetadata,
              sheetMappings: {} // Will be populated on demand
            });
          }

          updateProgress(Math.round((processed / totalItems) * 100));
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
        // Try cache first
        const cached = await loadCache(filePath);
        if (cached && cached.sheetNames && cached.sheetMetadata) {
          console.log(`[TranslateManager] Loaded sheet info from cache for selected file: ${filePath}`);
          const newFileSheets = new Map(fileSheetsData.value);
          newFileSheets.set(filePath, cached.sheetNames);
          fileSheetsData.value = newFileSheets;

          const newMetadata = { ...sheetMetadata.value };
          const newRowCounts = { ...sheetRowCounts.value };
          Object.keys(cached.sheetMetadata).forEach(sheetName => {
            const key = `${filePath}::${sheetName}`;
            newMetadata[key] = cached.sheetMetadata[sheetName];
            newRowCounts[key] = cached.sheetMetadata[sheetName].rowCount;
          });
          sheetMetadata.value = newMetadata;
          sheetRowCounts.value = newRowCounts;
          return;
        }

        const b64 = await readBinary(filePath);
        const workbook = XLSX.read(b64, { type: 'array' });

        const newFileSheets = new Map(fileSheetsData.value);
        newFileSheets.set(filePath, workbook.SheetNames);
        fileSheetsData.value = newFileSheets;

        const newMetadata = { ...sheetMetadata.value };
        const newRowCounts = { ...sheetRowCounts.value };

        const fileMetadata: Record<string, any> = {};
        workbook.SheetNames.forEach(name => {
          const metadata = extractSheetMetadata(workbook.Sheets[name]);
          const key = `${filePath}::${name}`;
          newMetadata[key] = metadata;
          newRowCounts[key] = metadata.rowCount;
          fileMetadata[name] = metadata;
        });

        sheetMetadata.value = newMetadata;
        sheetRowCounts.value = newRowCounts;

        // Save to cache
        await saveCache(filePath, {
          sheetNames: workbook.SheetNames,
          sheetMetadata: fileMetadata,
          sheetMappings: {}
        });
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

      // Try cache first
      const cached = await loadCache(filePath);
      if (cached && cached.sheetMappings && cached.sheetMappings[sheetName]) {
        console.log(`[TranslateManager] Loaded sheet mapping from cache: ${sheetKey}`);
        const mapping = new Map(Object.entries(cached.sheetMappings[sheetName]));
        const newMap = new Map(advancedDictData.value);
        newMap.set(sheetKey, mapping as Map<string, string>);
        advancedDictData.value = newMap;
        return;
      }

      // Fallback to Excel
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

        // Update cache with this sheet's data
        if (cached) {
          if (!cached.sheetMappings) cached.sheetMappings = {};
          cached.sheetMappings[sheetName] = Object.fromEntries(mapping);
          await saveCache(filePath, cached);
        }
      }
    } catch (err) {
      console.error(`[TranslateManager] Error loading sheet ${sheetName}:`, err);
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
    const sourceMap = new Map<string, WordSourceInfo>();

    // Helper to add word mapping with direction awareness
    const addToLookup = (l: string, p: string, info: WordSourceInfo) => {
      const logical = l?.toString().trim();
      const physical = p?.toString().trim();
      if (!logical || !physical) return;
      let source = '';
      let target = '';

      if (sharedTargetLang.value === 'jp') {
        source = logical; // Translate from English
        target = physical; // To Japanese
      } else if (sharedTargetLang.value === 'en') {
        source = physical; // Translate from Japanese
        target = logical; // To English
      } else if (sharedTargetLang.value === 'vi') {
        source = physical; // Translate from Japanese
        target = logical; // To English (as key) then we'd need VI mapping
        // Actually, for VI we need a separate mapping from JP/EN to VI
        // But for highlighting, let's just allow JP/EN to be highlighted
        sourceSet.add(logical);
        sourceSet.add(physical);
        sourceMap.set(logical, info);
        sourceMap.set(physical, info);
        return;
      }

      if (source && target && !lookup.has(source)) {
        lookup.set(source, target);
        sourceSet.add(source);
        targetSet.add(target);
        
        // Map both source and target for highlighting purposes
        sourceMap.set(source, info);
        sourceMap.set(target, info);
      }
    };

    // 1. Process Selected Sheets first (Insertion order = "First selected wins")
    selectedSheets.value.forEach(fullKey => {
      const parts = fullKey.split('::');
      const sheetName = parts[parts.length - 1];
      const info: WordSourceInfo = { type: 'tech', source: sheetName };

      // 1.1 Add Table/Sheet Name from Metadata
      const meta = sheetMetadata.value[fullKey];
      if (meta) {
        addToLookup(meta.logical, meta.physical, info);
      }

      // 1.2 Add Columns mappings
      const mapping = advancedDictData.value.get(fullKey);
      if (mapping) {
        mapping.forEach((physical, logical) => addToLookup(logical, physical, info));
      }
    });

    // 2. Process Base Dictionary (always check for 'composed' even if in ONLY mode)
    const baseInfo: WordSourceInfo = { type: 'base', source: 'Base Dictionary' };
    
    baseLookupPart.value.forEach((target, source) => {
      const exists = lookup.has(source);
      if (exists) {
        // It's in both tech and base -> mark as composed
        const existing = sourceMap.get(source);
        if (existing && existing.type === 'tech') {
          sourceMap.set(source, { ...existing, type: 'composed' });
          // Also update target if it exists
          const existingTarget = sourceMap.get(lookup.get(source)!);
          if (existingTarget && existingTarget.type === 'tech') {
            sourceMap.set(lookup.get(source)!, { ...existingTarget, type: 'composed' });
          }
        }
      } else if (!isOnlySelectedSheets.value) {
        // Only in base and not in ONLY mode
        lookup.set(source, target);
        sourceSet.add(source);
        targetSet.add(target);
        
        if (!sourceMap.has(source)) sourceMap.set(source, baseInfo);
        if (!sourceMap.has(target)) sourceMap.set(target, baseInfo);
      }
    });

    if (!isOnlySelectedSheets.value) {
      baseTargetWords.value.forEach(word => {
        targetSet.add(word);
        if (!sourceMap.has(word)) {
          sourceMap.set(word, baseInfo);
        } else {
          const existing = sourceMap.get(word);
          if (existing && existing.type === 'tech') {
            sourceMap.set(word, { ...existing, type: 'composed' });
          }
        }
      });
    }

    sourceWordsList.value = Array.from(sourceSet).sort((a, b) => b.length - a.length);
    targetWordsList.value = Array.from(targetSet).sort((a, b) => b.length - a.length);
    cachedLookup.value = lookup;
    wordSourceMap.value = sourceMap;
    translationRegex.value = buildTranslationRegex(lookup);

    performQuickTranslate();
  };

  const performQuickTranslate = () => {
    translateOutput.value = translateText(translateInput.value, translationRegex.value, cachedLookup.value);
  };

  const contentSearchMatches = ref<Map<string, string[]>>(new Map());

  const searchAllSheetsForText = async (query: string) => {
    if (!query || query.trim().length < 2) {
      contentSearchMatches.value = new Map();
      return;
    }
    
    const searchTerm = query.trim().toLowerCase();
    const matchesMap = new Map<string, string[]>();
    
    startLoading(`Searching content for "${query}"...`);
    
    try {
      const files = excelFilesInFolder.value;
      const total = files.length;
      
      for (let i = 0; i < total; i++) {
        const file = files[i];
        updateProgress(Math.round((i / total) * 100));
        
        // Try cache first
        const cached = await loadCache(file);
        let mappings = cached?.sheetMappings || {};
        
        // 1. Search in cached mappings
        for (const sheetName in mappings) {
          const mapping = mappings[sheetName];
          const matchedCols: string[] = [];
          for (const [logical, physical] of Object.entries(mapping)) {
            const lMatch = logical.toLowerCase().includes(searchTerm);
            const pMatch = physical && String(physical).toLowerCase().includes(searchTerm);
            if (lMatch || pMatch) {
              matchedCols.push(lMatch ? logical : String(physical));
            }
          }
          if (matchedCols.length > 0) {
            matchesMap.set(`${file}::${sheetName}`, matchedCols);
          }
        }
        
        // 2. If no mappings in cache, we MUST read the file
        if (Object.keys(mappings).length === 0) {
           try {
             const b64 = await readBinary(file);
             const workbook = XLSX.read(b64, { type: 'array' });
             const newMappings: Record<string, any> = {};
             
             for (const sheetName of workbook.SheetNames) {
               const worksheet = workbook.Sheets[sheetName];
               const mapping = parseTechnicalSheet(worksheet);
               if (mapping && mapping.size > 0) {
                 const plainMapping = Object.fromEntries(mapping);
                 newMappings[sheetName] = plainMapping;
                 
                 const matchedCols: string[] = [];
                 for (const [logical, physical] of mapping) {
                    const lMatch = logical.toLowerCase().includes(searchTerm);
                    const pMatch = physical && String(physical).toLowerCase().includes(searchTerm);
                    if (lMatch || pMatch) {
                      matchedCols.push(lMatch ? logical : String(physical));
                    }
                 }
                 if (matchedCols.length > 0) {
                   matchesMap.set(`${file}::${sheetName}`, matchedCols);
                 }
               }
             }
             // Save to persistent cache
             if (cached) {
               await saveCache(file, { ...cached, sheetMappings: newMappings });
             }
           } catch (err) {
             console.warn(`[TranslateManager] Deep search failed for ${file}:`, err);
           }
        }
      }
    } catch (err) {
      console.error('[TranslateManager] Deep search error:', err);
    } finally {
      contentSearchMatches.value = matchesMap;
      stopLoading();
    }
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
    contentSearchMatches,
    debouncedInput,
    translationRegex,
    cachedLookup,
    wordSourceMap,
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
    searchAllSheetsForText,
    simulateLoading
  };
}
