const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

const regexFile = /if \(p\.type === 'file' && configPath === normalizedPath\) \{\s*return \{ jpCol: p\.jpCol, physCol: p\.physCol, startRow: p\.startRow \};\s*\}/m;
const regexFolder = /if \(p\.type === 'folder' && normalizedPath\.startsWith\(configPath\)\) \{\s*return \{ jpCol: p\.jpCol, physCol: p\.physCol, startRow: p\.startRow \};\s*\}/m;

const replacementFile = `if (p.type === 'file' && configPath === normalizedPath) {
          return { jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow, jpNameCell: p.jpNameCell, enNameCell: p.enNameCell };
        }`;
const replacementFolder = `if (p.type === 'folder' && normalizedPath.startsWith(configPath)) {
          return { jpCol: p.jpCol, physCol: p.physCol, startRow: p.startRow, jpNameCell: p.jpNameCell, enNameCell: p.enNameCell };
        }`;

let replaced = false;
if (regexFile.test(code)) {
    code = code.replace(regexFile, replacementFile);
    replaced = true;
} else {
    console.log("Could not find regexFile match");
}

if (regexFolder.test(code)) {
    code = code.replace(regexFolder, replacementFolder);
    replaced = true;
} else {
    console.log("Could not find regexFolder match");
}

if (replaced) {
    fs.writeFileSync(path, code, 'utf8');
    console.log("useTranslateManager.ts successfully updated");
}
