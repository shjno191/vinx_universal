const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add rebuildTechDictionaryCache and loadTechDictionaryCache
const newFunctions = `
  const getTechCachePath = async () => {
    const configDir = await invoke<string>('get_app_config_dir');
    return \`\${configDir}/tech_dictionary.json\`.replace(/\\\\\\\\/g, '/');
  };

  const loadTechDictionaryCache = async () => {
    try {
      const cachePath = await getTechCachePath();
      const content = await invoke<string>('read_file_content', { path: cachePath });
      const cacheData = JSON.parse(content);
      
      const newMap = new Map<string, Map<string, string>>();
      const newMeta: Record<string, SheetMetadata> = {};
      
      for (const [fullKey, data] of Object.entries(cacheData as any)) {
          newMap.set(fullKey, new Map(Object.entries(data.columns)));
          newMeta[fullKey] = data.metadata as SheetMetadata;
      }
      
      advancedDictData.value = newMap;
      sheetMetadata.value = newMeta;
      console.log(\`[TranslateManager] Loaded tech dictionary cache (\${Object.keys(cacheData).length} sheets)\`);
      return true;
    } catch (e) {
      console.log("[TranslateManager] No tech dictionary cache found or invalid.");
      return false;
    }
  };

  const rebuildTechDictionaryCache = async () => {
    try {
      startLoading("Rebuilding Technical Dictionary Cache (this may take a while)...");
      const cacheData: any = {};
      
      for (const filePath of excelFilesInFolder.value) {
        try {
          const b64 = await readBinary(filePath);
          const workbook = XLSX.read(b64, { type: 'array' });
          const config = getConfigForFile(filePath);
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const meta = extractSheetMetadata(worksheet);
            const mapping = parseTechnicalSheet(worksheet, config);
            
            const fullKey = \`\${filePath}::\${sheetName}\`;
            cacheData[fullKey] = {
              metadata: meta,
              columns: Object.fromEntries(mapping)
            };
          }
        } catch (e) {
          console.error(\`Failed to parse \${filePath}\`, e);
        }
      }
      
      const cachePath = await getTechCachePath();
      await invoke('save_file_content', { path: cachePath, content: JSON.stringify(cacheData, null, 2) });
      console.log(\`[TranslateManager] Tech dictionary cache rebuilt and saved to \${cachePath}\`);
      
      await loadTechDictionaryCache();
    } catch (e) {
      console.error("[TranslateManager] Failed to rebuild tech dictionary cache", e);
    } finally {
      stopLoading();
    }
  };
`;

if (!code.includes('const loadTechDictionaryCache')) {
    code = code.replace('const loadSingleSheet =', newFunctions + '\\n  const loadSingleSheet =');
}

// 2. Export them
if (!code.includes('rebuildTechDictionaryCache,')) {
    code = code.replace('return {', 'return {\\n    rebuildTechDictionaryCache,\\n    loadTechDictionaryCache,');
}

// 3. Remove the old auto-load watcher
const watcherCodeStart = `  // Auto-load all sheets if user disables "Only Selected Sheets"
  watch([isOnlySelectedSheets, excelFilesInFolder, fileSheetsData], () => {`;
const watcherCodeEnd = `    }
  }, { deep: true });`;

if (code.includes(watcherCodeStart)) {
    const startIndex = code.indexOf(watcherCodeStart);
    const endIndex = code.indexOf(watcherCodeEnd, startIndex) + watcherCodeEnd.length;
    code = code.substring(0, startIndex) + code.substring(endIndex);
}

// 4. Modify loadFilesFromMultipleFolders to trigger build if cache is missing
const oldLoadFiles = `    if (files.length > 0) {
      await getSheetNamesForFiles(files);
    }`;
const newLoadFiles = `    if (files.length > 0) {
      await getSheetNamesForFiles(files);
      const loaded = await loadTechDictionaryCache();
      if (!loaded) {
        await rebuildTechDictionaryCache();
      }
    }`;

if (code.includes(oldLoadFiles)) {
    code = code.replace(oldLoadFiles, newLoadFiles);
}

fs.writeFileSync(path, code, 'utf8');
console.log('useTranslateManager.ts patched for JSON caching');
