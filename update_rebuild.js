const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

const regex = /for \(const sheetName of workbook\.SheetNames\) \{\s*const worksheet = workbook\.Sheets\[sheetName\];\s*const meta = extractSheetMetadata\(worksheet\);\s*const mapping = parseTechnicalSheet\(worksheet, config\);/m;

const replacement = `for (const sheetName of workbook.SheetNames) {
            // Skip sheets with Japanese characters
            if (/[\\u3000-\\u303F\\u3040-\\u309F\\u30A0-\\u30FF\\uFF00-\\uFFEF\\u4E00-\\u9FAF\\u2605-\\u2606\\u2190-\\u2195|\\u203B]/.test(sheetName)) {
              continue;
            }
            const worksheet = workbook.Sheets[sheetName];
            const meta = extractSheetMetadata(worksheet, config);
            const mapping = parseTechnicalSheet(worksheet, config);`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(path, code, 'utf8');
    console.log("rebuildTechDictionaryCache successfully updated");
} else {
    console.log("Could not find loop to replace");
}
