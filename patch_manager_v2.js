const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove deep search from triggerDebouncedTranslate
const badDebounceStart = `      // Auto-trigger Deep Search if input is a single word and not found in lookup
      const trimmed = translateInput.value.trim();
      if (trimmed && !trimmed.includes(' ') && trimmed.length > 3 && cachedLookup.value) {`;
      
const badDebounceEnd = `      // Try to auto-select sheet if none selected`;

if (code.includes(badDebounceStart)) {
    const startIndex = code.indexOf(badDebounceStart);
    const endIndex = code.indexOf(badDebounceEnd, startIndex);
    if (startIndex !== -1 && endIndex !== -1) {
        const toReplace = code.substring(startIndex, endIndex);
        code = code.replace(toReplace, "");
    }
}

// 2. Add Auto-Load Watcher
const watcherCode = `
  // Auto-load all sheets if user disables "Only Selected Sheets"
  watch([isOnlySelectedSheets, excelFilesInFolder, fileSheetsData], () => {
    if (!isOnlySelectedSheets.value) {
      let promises: Promise<void>[] = [];
      excelFilesInFolder.value.forEach(file => {
        const sheets = fileSheetsData.value.get(file) || [];
        sheets.forEach(sheet => {
          const fullKey = \`\${file}::\${sheet}\`;
          if (!advancedDictData.value.has(fullKey)) {
            promises.push(loadSingleSheet(file, sheet));
          }
        });
      });
      if (promises.length > 0) {
        Promise.all(promises).then(() => {
          updateCachedWords();
        });
      }
    }
  }, { deep: true });
  
  return {`;

code = code.replace('  return {', watcherCode);

// 3. Update updateCachedWords to process all loaded sheets if not isOnlySelectedSheets
const oldUpdate = `    // 1. Process Active Sheets first (Insertion order = "First selected wins")
    activeSheets.value.forEach(fullKey => {
      const parts = fullKey.split('::');`;

const newUpdate = `    // 1. Process Active Sheets first (Insertion order = "First selected wins")
    const sheetsToProcess = isOnlySelectedSheets.value 
        ? Array.from(activeSheets.value) 
        : Array.from(advancedDictData.value.keys());

    sheetsToProcess.forEach(fullKey => {
      const parts = fullKey.split('::');`;

code = code.replace(oldUpdate, newUpdate);

fs.writeFileSync(path, code, 'utf8');
console.log('useTranslateManager.ts patched for auto load');
