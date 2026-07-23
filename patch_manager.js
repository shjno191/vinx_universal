const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix deduplication in loadDictionary
const oldDedup = `        // Deduplicate based on JP and EN columns (2 first columns)
        const totalRows = rawRows.length;
        const finalRows: any[] = [];
        const uniqueMap = new Map();

        for (const [idx, row] of rawRows.entries()) {
          const key = \`\${row.jp}|\${row.en}\`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, row);
            finalRows.push(row);
          }
          if (idx % 1000 === 0) {
            updateProgress(Math.round((idx / totalRows) * 100));
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }`;

const newDedup = `        // Deduplicate based on JP and EN columns (2 first columns)
        // Keep the LAST occurrence (so newer edits override older ones)
        const totalRows = rawRows.length;
        const uniqueMap = new Map();

        for (const [idx, row] of rawRows.entries()) {
          const key = \`\${row.jp}|\${row.en}\`;
          uniqueMap.set(key, row); // Overwrites with newer row
          
          if (idx % 1000 === 0) {
            updateProgress(Math.round((idx / totalRows) * 100));
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        const finalRows = Array.from(uniqueMap.values());`;

code = code.replace(oldDedup, newDedup);

// 2. Implement detectLanguageAndSetTarget
const oldDetect = `  const detectLanguageAndSetTarget = (text: string) => {
    // Disabled auto-language detection as it overrides manual selection and causes confusion
    return;
  };`;

const newDetect = `  const detectLanguageAndSetTarget = (text: string) => {
    if (!text || text.trim().length === 0) return;
    
    let jpCount = 0;
    let enCount = 0;
    
    // Sample up to 100 characters to avoid freezing on huge text
    const sample = text.substring(0, 100);
    for (const char of sample) {
      if (/[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(char)) jpCount++;
      else if (/[A-Za-z]/.test(char)) enCount++;
    }

    if (jpCount > 0 && jpCount > enCount * 0.1) {
      // If it has substantial Japanese, target English
      sharedTargetLang.value = 'en';
    } else if (enCount > jpCount) {
      // If mostly English, target Japanese
      sharedTargetLang.value = 'jp';
    }
  };`;

code = code.replace(oldDetect, newDetect);

// 3. Re-enable detectLanguageAndSetTarget
const oldDebounce = `      const oldLang = sharedTargetLang.value;
      // detectLanguageAndSetTarget(translateInput.value); // Disabled
      
      // Try to auto-select sheet if none selected`;

const newDebounce = `      const oldLang = sharedTargetLang.value;
      detectLanguageAndSetTarget(translateInput.value);
      
      // Try to auto-select sheet if none selected`;

code = code.replace(oldDebounce, newDebounce);

fs.writeFileSync(path, code, 'utf8');
console.log('useTranslateManager.ts patched');
