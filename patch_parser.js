const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\sheet-parser.ts';
let code = fs.readFileSync(path, 'utf8');

const oldCode = `  let logical = '';
  let physical = '';
  let rowCount = 0;

  // Search for table names in the first 30 rows`;

const newCode = `  let logical = '';
  let physical = '';
  let rowCount = 0;

  // 1. Try to extract logical name from cell A2 (often the JP name in technical specs)
  if (jsonData.length > 1 && jsonData[1] && jsonData[1][0]) {
    const a2Val = String(jsonData[1][0] || '').trim();
    if (/[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(a2Val) && a2Val.length < 100) {
      logical = a2Val;
    }
  }
  // Also check A1 just in case
  if (!logical && jsonData.length > 0 && jsonData[0] && jsonData[0][0]) {
    const a1Val = String(jsonData[0][0] || '').trim();
    if (/[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(a1Val) && a1Val.length < 100) {
      logical = a1Val;
    }
  }

  // Search for table names in the first 30 rows`;

code = code.replace(oldCode, newCode);

fs.writeFileSync(path, code, 'utf8');
console.log('sheet-parser.ts patched');
