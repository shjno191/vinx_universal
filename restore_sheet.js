const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// The corrupted block starts at line 617:
//   };
//       if (cached && cached.sheetMappings && cached.sheetMappings[sheetName]) {

const corruptedCode = `    } finally {
      stopLoading();
    }
  };
      if (cached && cached.sheetMappings && cached.sheetMappings[sheetName]) {
        const cachedConfigStr = JSON.stringify(cached.config || {});`;

const restoredCode = `    } finally {
      stopLoading();
    }
  };

  const loadSingleSheet = async (filePath: string, sheetName: string) => {
    const sheetKey = \`\${filePath}::\${sheetName}\`;
    if (advancedDictData.value.has(sheetKey)) return;

    try {
      startLoading(\`Loading sheet: \${sheetName}...\`);

      // Try cache first
      const { loadCache, saveCache } = useCacheManager();
      const cached = await loadCache(filePath);
      const config = getConfigForFile(filePath);
      
      let isValidCache = false;
      if (cached && cached.sheetMappings && cached.sheetMappings[sheetName]) {
        const cachedConfigStr = JSON.stringify(cached.config || {});`;

if (code.includes(corruptedCode)) {
    code = code.replace(corruptedCode, restoredCode);
    fs.writeFileSync(path, code, 'utf8');
    console.log("loadSingleSheet successfully restored");
} else {
    console.log("Could not find the corrupted code block. The file might look different.");
}
