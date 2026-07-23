const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// The corrupted block at line 100 is:
//         if (p.type === 'file' && configPath === normalizedPath) {
//         
// 
//   
//     return {\n    rebuildTechDictionaryCache,\n    loadTechDictionaryCache, jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow };
//         }

// Note: \n is literal in the text!
const badCode = "    return {\\n    rebuildTechDictionaryCache,\\n    loadTechDictionaryCache, jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow };";
const goodCode = "          return { jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow };";

if (code.includes(badCode)) {
    code = code.replace(badCode, goodCode);
    console.log("Fixed corrupted return statement in getConfigForFile");
} else {
    // Try regex if literal \n wasn't found
    code = code.replace(/return \{\\n\s*rebuildTechDictionaryCache,\\n\s*loadTechDictionaryCache,\s*jpCol:/g, 'return { jpCol:');
    console.log("Attempted to fix corrupted return statement via Regex");
}

// Ensure exports at the end of the file
const exportTarget = "loadFilesFromMultipleFolders,";
if (code.includes(exportTarget) && !code.includes("rebuildTechDictionaryCache,")) {
    code = code.replace(exportTarget, exportTarget + "\\n    rebuildTechDictionaryCache,\\n    loadTechDictionaryCache,");
    console.log("Added exports to the end of the composable");
}

fs.writeFileSync(path, code, 'utf8');
