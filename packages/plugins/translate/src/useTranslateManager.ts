import { ref, shallowRef, watch, nextTick } from 'vue';
import * as XLSX from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import {
  translateInput,
  translateOutput,
  sharedTargetLang,
  useFileSystem,
  useGlobalLoading,
  advancedTranslateGroups
} from '@vinx/sdk';
import { buildTranslationRegex, translateText } from './translation-engine';
import { parseTechnicalSheet, extractSheetMetadata, SheetConfig } from './sheet-parser';
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
const advancedConfigs = ref<Record<string, any>>({});

const selectedFolder = ref<string>('');
const excelFilesInFolder = shallowRef<string[]>([]);
const selectedFiles = ref<Set<string>>(new Set());
const fileSheetsData = shallowRef<Map<string, string[]>>(new Map());
const selectedSheets = ref<Set<string>>(new Set());
const activeSheets = ref<Set<string>>(new Set());

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

  const getConfigForFile = (filePath: string): SheetConfig | undefined => {
    if (!filePath) return undefined;
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const group of advancedTranslateGroups.value) {
      if (!group.active) continue;
      for (const p of group.paths) {
        const configPath = (p.path || '').replace(/\\/g, '/');
        if (p.type === 'file' && configPath === normalizedPath) {
          return { jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow, jpNameCell: p.jpNameCell, enNameCell: p.enNameCell };
        }
        if (p.type === 'folder' && normalizedPath.startsWith(configPath)) {
          return { jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow, jpNameCell: p.jpNameCell, enNameCell: p.enNameCell };
        }
      }
    }
    return undefined;
  };

  const detectLanguageAndSetTarget = (text: string) => {
    // Disabled auto-language detection as it overrides manual selection and causes confusion
    return;
  };

  const autoSelectSheetFromInput = async (text: string) => {
    if (!text || text.trim().length < 3 || selectedSheets.value.size > 0) return;
    
    // Extract unique keywords from input (lines and words)
    const rawTokens = text.split(/[\n\s,]+/).map(t => t.trim()).filter(t => t.length >= 3);
    const keywords = [...new Set(rawTokens)].slice(0, 30); // Use top 30 unique tokens
    if (keywords.length === 0) return;
    
    let bestSheetKey = '';
    let maxScore = 0;
    
    for (const file of excelFilesInFolder.value) {
      const cached = await loadCache(file);
      const mappings = cached?.sheetMappings;
      if (!mappings) continue;
      
      for (const sheetName in mappings) {
        const mapping = mappings[sheetName];
        let currentScore = 0;
        
        // Count how many keywords are present in this sheet's mapping
        for (const query of keywords) {
          const searchTerm = query.toLowerCase();
          for (const [logical, physical] of Object.entries(mapping)) {
            if (logical.toLowerCase() === searchTerm || 
                (physical && String(physical).toLowerCase() === searchTerm)) {
              currentScore++;
              break; // This keyword matches this sheet, move to next keyword
            }
          }
        }
        
        if (currentScore > maxScore) {
          maxScore = currentScore;
          bestSheetKey = `${file}::${sheetName}`;
        }
      }
    }
    
    if (bestSheetKey && maxScore > 0) {
      const [file, sheetName] = bestSheetKey.split('::');
      console.log(`[TranslateManager] Auto-selecting best sheet (Score: ${maxScore}): ${bestSheetKey}`);
      
      selectedSheets.value.add(bestSheetKey);
      activeSheets.value.add(bestSheetKey);
      await loadSingleSheet(file, sheetName);
      rebuildBaseDictionaryCache();
      updateCachedWords();
      return true;
    }
    
    return false;
  };

  let translateDebounceTimer: any = null;
  const triggerDebouncedTranslate = () => {
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    translateDebounceTimer = setTimeout(async () => {
      const oldLang = sharedTargetLang.value;
      // detectLanguageAndSetTarget(translateInput.value); // Disabled
      
      // Try to auto-select sheet if none selected
      const autoSelected = await autoSelectSheetFromInput(translateInput.value);

      // If language changed OR auto-selected, we need to rebuild cache
      if (sharedTargetLang.value !== oldLang || autoSelected) {
        rebuildBaseDictionaryCache();
        updateCachedWords();
      }

      debouncedInput.value = translateInput.value;
      performQuickTranslate();
    }, 450); // Slightly longer debounce for auto-select logic
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
        let jpIdx = 0;
        let enIdx = 1;
        let viIdx = 2;

        // Auto-detect columns based on content to handle swapped columns
        const colProfiles: Record<number, { jp: number, en: number, total: number }> = {};
        const sampleLimit = Math.min(jsonData.length, 100);
        
        // Start from 0 to also profile headers if they exist, but mostly data
        for (let i = 0; i < sampleLimit; i++) {
          const row = jsonData[i] || [];
          row.forEach((cell, colIdx) => {
            const s = String(cell || '').trim();
            if (!s) return;
            if (!colProfiles[colIdx]) colProfiles[colIdx] = { jp: 0, en: 0, total: 0 };
            colProfiles[colIdx].total++;
            
            // Profile JP characters
            if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(s) && s.length < 50) {
              colProfiles[colIdx].jp++;
            } 
            // Profile English characters
            else if (/^[A-Za-z0-9_$#.]+$/.test(s) && /[A-Za-z]/.test(s)) {
              colProfiles[colIdx].en++;
            }
          });
        }
        
        let bestJpIdx = 0, bestJpScore = -1;
        let bestEnIdx = 1, bestEnScore = -1;
        for (const [colIdxStr, prof] of Object.entries(colProfiles)) {
          const colIdx = parseInt(colIdxStr);
          if (prof.jp > bestJpScore) { bestJpScore = prof.jp; bestJpIdx = colIdx; }
          if (prof.en > bestEnScore) { bestEnScore = prof.en; bestEnIdx = colIdx; }
        }
        
        // If we confidently found different columns for JP and EN
        if (bestJpScore > 0 && bestEnScore > 0 && bestJpIdx !== bestEnIdx) {
          jpIdx = bestJpIdx;
          enIdx = bestEnIdx;
          
          // Vi is typically the 3rd remaining column
          const allCols = Object.keys(colProfiles).map(Number);
          const remaining = allCols.filter(c => c !== jpIdx && c !== enIdx);
          if (remaining.length > 0) viIdx = remaining[0];
        }

        console.log(`[TranslateManager] Base Dictionary detected columns: JP=${jpIdx}, EN=${enIdx}, VI=${viIdx}`);

        const rawRows = jsonData.slice(1)
          .map(row => ({
            jp: (row[jpIdx] || '').toString().trim(),
            en: (row[enIdx] || '').toString().trim(),
            vi: (row[viIdx] || '').toString().trim()
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
      for (const p of folders) {
        try {
          // Check if path is a directory or a file
          const node = await invoke('read_dir_tree', { path: p, depth: 0 }) as any;
          if (node.is_dir) {
            const files = await invoke('list_files_in_dir', { path: p, extension: 'xlsx' }) as string[];
            const normalized = files.map(f => String(f).replace(/\\/g, '/'));
            allFiles.push(...normalized);
          } else {
            // It's a file, check if it's an Excel file
            if (p.toLowerCase().endsWith('.xlsx') || p.toLowerCase().endsWith('.xls')) {
              allFiles.push(p.replace(/\\/g, '/'));
            }
          }
        } catch (err) {
          console.warn(`[TranslateManager] Skip path ${p}:`, err);
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
      const newActiveSheets = new Set(activeSheets.value);
      const newDictData = new Map(advancedDictData.value);
      for (const s of newSelectedSheets) {
        if (s.startsWith(`${filePath}::`)) {
          newSelectedSheets.delete(s);
          newActiveSheets.delete(s);
          newDictData.delete(s);
        }
      }
      selectedSheets.value = newSelectedSheets;
      activeSheets.value = newActiveSheets;
      advancedDictData.value = newDictData;
    } else {
      selectedFiles.value.add(filePath);
      await selectExcelFile(filePath);
    }
    updateCachedWords();
  };

  
  /**
   * Gets the AppData mirror directory for a given source folder.
   * e.g., "C:/Users/.../02.テーブル定義書" → "%APPDATA%/vinx_universal/cache/02.テーブル定義書"
   */
  const getCacheMirrorDir = async (sourceFolderPath: string): Promise<string> => {
    const configDir = await invoke<string>('get_app_config_dir');
    const folderName = sourceFolderPath.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() || 'default';
    return `${configDir}/cache/${folderName}`.replace(/\\/g, '/');
  };

  const loadTechDictionaryCache = async () => {
    try {
      const newMap = new Map<string, Map<string, string>>();
      const newMeta: Record<string, SheetMetadata> = {};
      let totalSheets = 0;

      // Collect all source folders from active groups
      const sourceFolders = new Set<string>();
      for (const group of advancedTranslateGroups.value) {
        if (!group.active) continue;
        for (const p of group.paths) {
          if (p.type === 'folder') sourceFolders.add(p.path.replace(/\\/g, '/'));
        }
      }

      for (const sourceFolder of sourceFolders) {
        try {
          const mirrorDir = await getCacheMirrorDir(sourceFolder);
          const jsonFiles = await invoke<string[]>('list_files_in_dir', { path: mirrorDir, extension: 'json' });

          for (const jsonFile of jsonFiles) {
            try {
              const content = await invoke<string>('read_file_content', { path: jsonFile });
              const fileData = JSON.parse(content) as Record<string, any>;

              for (const [sheetName, sheetData] of Object.entries(fileData)) {
                const fullKey = sheetData.fullKey || `${sheetData.filePath}::${sheetName}`;
                newMap.set(fullKey, new Map(Object.entries(sheetData.columns || {})));
                newMeta[fullKey] = { logicalName: sheetData.jp, physicalName: sheetData.en, rowCount: sheetData.rowCount || 0 };
                totalSheets++;
              }
            } catch (e) {
              console.warn(`[TranslateManager] Skip invalid JSON: ${jsonFile}`, e);
            }
          }
        } catch (e) {
          console.warn(`[TranslateManager] No mirror dir for: ${sourceFolder}`, e);
        }
      }

      advancedDictData.value = newMap;
      sheetMetadata.value = newMeta;
      console.log(`[TranslateManager] Loaded tech dictionary from mirror cache (${totalSheets} sheets)`);
      return totalSheets > 0;
    } catch (e) {
      console.error("[TranslateManager] Failed to load tech dictionary cache:", e);
      return false;
    }
  };

  const rebuildTechDictionaryCache = async () => {
    try {
      startLoading("Rebuilding Technical Dictionary Cache...");

      // Collect all source folders from active groups
      const sourceFolders = new Set<string>();
      for (const group of advancedTranslateGroups.value) {
        if (!group.active) continue;
        for (const p of group.paths) {
          if (p.type === 'folder') sourceFolders.add(p.path.replace(/\\/g, '/'));
        }
      }

      // Group excel files by their parent folder
      for (const sourceFolder of sourceFolders) {
        const mirrorDir = await getCacheMirrorDir(sourceFolder);

        // Create mirror directory in AppData
        await invoke('create_dir_all', { path: mirrorDir });
        console.log(`[TranslateManager] Created mirror dir: ${mirrorDir}`);

        // Get all excel files in this source folder
        const excelFiles = excelFilesInFolder.value.filter(f => {
          const normalized = f.replace(/\\/g, '/');
          return normalized.startsWith(sourceFolder);
        });

        for (const filePath of excelFiles) {
          try {
            const b64 = await readBinary(filePath);
            const workbook = XLSX.read(b64, { type: 'array' });
            const config = getConfigForFile(filePath);

            const fileJson: Record<string, any> = {};

            for (const sheetName of workbook.SheetNames) {
              // Skip sheets with Japanese characters
              if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(sheetName)) {
                continue;
              }

              const worksheet = workbook.Sheets[sheetName];
              const meta = extractSheetMetadata(worksheet, config);
              const mapping = parseTechnicalSheet(worksheet, config);

              fileJson[sheetName] = {
                fullKey: `${filePath}::${sheetName}`,
                filePath,
                jp: meta.logicalName,
                en: meta.physicalName,
                rowCount: meta.rowCount,
                columns: Object.fromEntries(mapping)
              };
            }

            // Write JSON file with same name as Excel file
            const fileName = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.xlsx?$/i, '') || 'unknown';
            const jsonPath = `${mirrorDir}/${fileName}.json`;
            await invoke('save_file_content', { path: jsonPath, content: JSON.stringify(fileJson, null, 2) });
            console.log(`[TranslateManager] Saved cache: ${jsonPath}`);
          } catch (e) {
            console.error(`[TranslateManager] Failed to parse ${filePath}:`, e);
          }
        }
      }

      await loadTechDictionaryCache();
    } catch (e) {
      console.error("[TranslateManager] Failed to rebuild tech dictionary cache:", e);
    } finally {
      stopLoading();
    }
  };

  const loadSingleSheet = async (filePath: string, sheetName: string) => {
    const sheetKey = `${filePath}::${sheetName}`;
    if (advancedDictData.value.has(sheetKey)) return;

    try {
      startLoading(`Loading sheet: ${sheetName}...`);

      // Try cache first
      const { loadCache, saveCache } = useCacheManager();
      const cached = await loadCache(filePath);
      const config = getConfigForFile(filePath);
      
      let isValidCache = false;
      if (cached && cached.sheetMappings && cached.sheetMappings[sheetName]) {
        const cachedConfigStr = JSON.stringify(cached.config || {});
        const currentConfigStr = JSON.stringify(config || {});
        if (cachedConfigStr === currentConfigStr) {
          isValidCache = true;
        }
      }

      if (isValidCache) {
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

      const mapping = parseTechnicalSheet(worksheet, config);
      if (mapping && mapping.size > 0) {
        console.log(`[TranslateManager] Loaded ${mapping.size} mappings from sheet: ${sheetName}`);
        const newMap = new Map(advancedDictData.value);
        newMap.set(sheetKey, mapping);
        advancedDictData.value = newMap;

        // Update cache with this sheet's data
        if (cached) {
          if (!cached.sheetMappings) cached.sheetMappings = {};
          cached.sheetMappings[sheetName] = Object.fromEntries(mapping);
          cached.config = config;
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
        source = physical; // Translate from English (Physical)
        target = logical;  // To Japanese (Logical)
      } else if (sharedTargetLang.value === 'en') {
        source = logical;  // Translate from Japanese (Logical)
        target = physical; // To English (Physical)
      } else if (sharedTargetLang.value === 'vi') {
        // For Vietnamese, we allow both directions to be highlighted
        sourceSet.add(logical);
        sourceSet.add(physical);
        sourceMap.set(logical, info);
        sourceMap.set(physical, info);
        
        // Fix for ONLY mode: Try to fetch VI translation from Base Dictionary
        const viLogical = baseLookupPart.value.get(logical);
        const viPhysical = baseLookupPart.value.get(physical);
        
        if (viLogical) {
          lookup.set(logical, viLogical);
          targetSet.add(viLogical);
          sourceMap.set(viLogical, info);
        }
        if (viPhysical) {
          lookup.set(physical, viPhysical);
          targetSet.add(viPhysical);
          sourceMap.set(viPhysical, info);
        }
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

    // 1. Process Active Sheets first (Insertion order = "First selected wins")
    activeSheets.value.forEach(fullKey => {
      const parts = fullKey.split('::');
      const sheetName = parts[parts.length - 1];
      const info: WordSourceInfo = { type: 'tech', source: sheetName };

      // 1.1 Add Table/Sheet Name from Metadata
      const meta = sheetMetadata.value[fullKey];
      if (meta) {
        addToLookup(meta.logicalName, meta.physicalName, info);
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
      const isJpText = (text: string) => /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/.test(text || '');
      if (sharedTargetLang.value === 'jp' && isJpText(source)) return;
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
        const config = getConfigForFile(file);
        let mappings: Record<string, any> = {};
        
        const cachedConfigStr = JSON.stringify(cached?.config || {});
        const currentConfigStr = JSON.stringify(config || {});
        
        if (cached && cachedConfigStr === currentConfigStr) {
           mappings = cached.sheetMappings || {};
        }
        
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
               const config = getConfigForFile(file);
               const mapping = parseTechnicalSheet(worksheet, config);
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
               await saveCache(file, { ...cached, sheetMappings: newMappings, config });
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
    activeSheets,
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
    rebuildTechDictionaryCache,
    loadTechDictionaryCache,

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
