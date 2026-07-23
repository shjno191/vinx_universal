const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// The corrupted block at line 617 is:
//   \\n  const loadSingleSheet = async (filePath: string, sheetName: string) => {

if (code.includes('\\n  const loadSingleSheet')) {
    code = code.replace('\\n  const loadSingleSheet', '\\n  const loadSingleSheet');
    // Wait, replacing literal "\\n" with actual "\n"
    code = code.replace(/\\n  const loadSingleSheet/g, '\\n  const loadSingleSheet');
}

// Since I just used Regex, let's just do a blanket replace for the exact corrupted string
code = code.replace(/\\n\s*const loadSingleSheet/g, '\\n  const loadSingleSheet');

fs.writeFileSync(path, code, 'utf8');
console.log("Fixed literal \\n before loadSingleSheet");
