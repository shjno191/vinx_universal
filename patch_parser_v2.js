const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\sheet-parser.ts';
let code = fs.readFileSync(path, 'utf8');

const oldCode = `  // 1. Try to extract logical name from cell A2 (often the JP name in technical specs)
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

  // Search for table names in the first 30 rows
  for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
    const row = jsonData[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      // Look for typical table name declarations
      if (cell.includes('テーブル') || cell.includes('Table') || cell.includes('表名') || cell.includes('エンティティ') || cell.includes('論理') || cell.includes('物理')) {
        // Search next cells in the same row
        for (let k = j + 1; k < row.length; k++) {
           const val = String(row[k] || '').trim();
           if (val) {
             if (!logical && /[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(val)) logical = val;
             else if (!physical && isPhysicalLike(val)) physical = val;
           }
        }
      }
    }
    if (logical && physical) break;
  }`;

const newCode = `  const excludedWords = ['テーブル物理名', 'テーブル論理名', '物理名', '論理名', '項目名', 'テーブル名', 'エンティティ名', '表名'];
  const isValidLogical = (s: string) => {
    if (!s || s.length > 100) return false;
    if (!/[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(s)) return false;
    
    // Check if it's strictly just an excluded word (allowing for some whitespace/colon)
    const normalized = s.replace(/[：:\\s]/g, '').toLowerCase();
    return !excludedWords.some(ew => normalized === ew);
  };

  // Helper to extract logical name from a specific row, checking cell 0 and cell 1
  const checkRowForLogical = (rowIdx: number) => {
    if (jsonData.length > rowIdx && jsonData[rowIdx]) {
      const row = jsonData[rowIdx];
      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      
      // If col0 is an excluded word, the real name is likely in col1
      if (col0 && !isValidLogical(col0) && excludedWords.some(ew => col0.replace(/[：:\\s]/g, '').toLowerCase() === ew)) {
        if (isValidLogical(col1)) return col1;
      }
      
      if (isValidLogical(col0)) return col0;
      if (isValidLogical(col1)) return col1;
    }
    return '';
  };

  // 1. Try to extract logical name from cell A2 (often the JP name in technical specs) or adjacent B2
  logical = checkRowForLogical(1);
  
  // Also check A1/B1 just in case
  if (!logical) {
    logical = checkRowForLogical(0);
  }

  // Search for table names in the first 30 rows
  for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
    const row = jsonData[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      // Look for typical table name declarations
      if (cell.includes('テーブル') || cell.includes('Table') || cell.includes('表名') || cell.includes('エンティティ') || cell.includes('論理') || cell.includes('物理')) {
        // Search next cells in the same row
        for (let k = j + 1; k < row.length; k++) {
           const val = String(row[k] || '').trim();
           if (val) {
             if (!logical && isValidLogical(val)) logical = val;
             else if (!physical && isPhysicalLike(val)) physical = val;
           }
        }
      }
    }
    if (logical && physical) break;
  }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync(path, code, 'utf8');
console.log('sheet-parser.ts patched for metadata');
