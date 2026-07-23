const fs = require('fs');

const engPath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translation-engine.ts';
let engCode = fs.readFileSync(engPath, 'utf8');

engCode = engCode.replace(
  "return new RegExp(`(${pattern})`, 'g');",
  "return new RegExp(`(${pattern})`, 'gi');"
);

engCode = engCode.replace(
  `  return input.replace(regex, (match) => {
    return lookup.get(match) || match;
  });`,
  `  // Case insensitive lookup
  return input.replace(regex, (match) => {
    const lowerMatch = match.toLowerCase();
    for (const [key, val] of lookup.entries()) {
      if (key.toLowerCase() === lowerMatch) return val;
    }
    return match;
  });`
);

fs.writeFileSync(engPath, engCode, 'utf8');
console.log('translation-engine.ts patched');


const tmPath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let tmCode = fs.readFileSync(tmPath, 'utf8');

// For deep search auto-trigger
const oldDebounce = `      const oldLang = sharedTargetLang.value;
      detectLanguageAndSetTarget(translateInput.value);
      
      // Try to auto-select sheet if none selected`;

const newDebounce = `      const oldLang = sharedTargetLang.value;
      detectLanguageAndSetTarget(translateInput.value);

      // Auto-trigger Deep Search if input is a single word and not found in lookup
      const trimmed = translateInput.value.trim();
      if (trimmed && !trimmed.includes(' ') && trimmed.length > 3 && cachedLookup.value) {
        let found = false;
        for (const key of cachedLookup.value.keys()) {
          if (key.toLowerCase() === trimmed.toLowerCase()) {
            found = true;
            break;
          }
        }
        if (!found) {
          // Trigger deep search silently
          searchAllSheetsForText(trimmed).then(() => {
             // If matches found, we could auto-load them, but currently searchAllSheetsForText updates contentSearchMatches
             // which is displayed in the UI. 
             // To make it translate instantly, we should force load the matched sheets into advancedDictData
             if (contentSearchMatches.value.size > 0) {
                const sheetsToLoad = Array.from(contentSearchMatches.value.keys());
                Promise.all(sheetsToLoad.map(key => {
                   const parts = key.split('::');
                   const filePath = parts.slice(0, -1).join('::');
                   const sheetName = parts[parts.length - 1];
                   return loadSingleSheet(filePath, sheetName);
                })).then(() => {
                   // Add them to active sheets to be included in lookup
                   let changed = false;
                   sheetsToLoad.forEach(key => {
                     if (!activeSheets.value.has(key)) {
                       activeSheets.value.add(key);
                       changed = true;
                     }
                   });
                   if (changed) updateCachedWords();
                });
             }
          });
        }
      }
      
      // Try to auto-select sheet if none selected`;

tmCode = tmCode.replace(oldDebounce, newDebounce);

fs.writeFileSync(tmPath, tmCode, 'utf8');
console.log('useTranslateManager.ts patched for auto deep search');
