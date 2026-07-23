const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\sheet-parser.ts';
let code = fs.readFileSync(path, 'utf8');

const oldMetaFunction = code.substring(code.indexOf('export function extractSheetMetadata'), code.indexOf('  // Count rows starting from Row 5'));

const newMetaFunction = `export function extractSheetMetadata(worksheet: XLSX.WorkSheet): SheetMetadata {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  let logical = '';
  let physical = '';
  let rowCount = 0;

  const excludedWords = [
    'テーブル物理名', 'テーブル論理名', '物理名', '論理名', '項目名', 'テーブル名', 'エンティティ名', '表名', 
    'no', 'no.', '作成者', '更新日', 'システム', '作成日', '更新者', 'システム名', 'サブシステム名', '機能名',
    '変更履歴', '改定履歴', 'シート名', '定義', 'テーブル定義', 'エンティティ定義'
  ];
  const isValidLogical = (s: string) => {
    if (!s || s.length > 100) return false;
    if (!/[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]/.test(s)) return false;
    
    const normalized = s.replace(/[：:\\s]/g, '').toLowerCase();
    // Exclude if it strictly matches one of the excluded words
    return !excludedWords.some(ew => normalized === ew);
  };

  // 1. Explicitly scan the first 10 rows for metadata headers and adjacent values
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
    const row = jsonData[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').replace(/[：:\\s]/g, '').toLowerCase();
      if (!cell) continue;
      
      if (excludedWords.includes(cell) || cell.includes('テーブル') || cell.includes('論理') || cell.includes('物理')) {
        const nextCell = String(row[j + 1] || '').trim();
        const nextNext = String(row[j + 2] || '').trim();
        
        if (cell.includes('論理') || cell.includes('エンティティ') || cell.includes('表名') || cell.includes('シート名')) {
           if (!logical && isValidLogical(nextCell)) logical = nextCell;
           else if (!logical && isValidLogical(nextNext)) logical = nextNext;
        } else if (cell.includes('物理') || cell.includes('テーブル名')) {
           if (!physical && isPhysicalLike(nextCell)) physical = nextCell;
           else if (!physical && isPhysicalLike(nextNext)) physical = nextNext;
        }
      }
    }
  }

  // 2. If not found via headers, scan col A, B, C, D of first 10 rows for the first valid logical and physical names
  if (!logical || !physical) {
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
       const row = jsonData[i] || [];
       for (let j = 0; j < Math.min(row.length, 5); j++) {
         const cell = String(row[j] || '').trim();
         if (!logical && isValidLogical(cell)) {
            logical = cell;
         } else if (!physical && isPhysicalLike(cell)) {
            physical = cell;
         }
       }
    }
  }

  // 3. Fallback: Search for table name patterns if still nothing found
  if (!logical || !physical) {
    for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
      const row = jsonData[i] || [];
      let tempJp = '';
      let tempEn = '';
      for (const cell of row) {
        const s = String(cell || '').trim();
        if (s.length > 0 && s.length < 100) {
          if (!tempJp && isValidLogical(s)) tempJp = s;
          else if (!tempEn && isPhysicalLike(s)) tempEn = s;
        }
      }
      if (tempJp && tempEn) {
        if (!logical) logical = tempJp;
        if (!physical) physical = tempEn;
        break;
      }
    }
  }
`;

code = code.replace(oldMetaFunction, newMetaFunction);
fs.writeFileSync(path, code, 'utf8');
console.log('sheet-parser.ts patched for metadata fallback fix');
