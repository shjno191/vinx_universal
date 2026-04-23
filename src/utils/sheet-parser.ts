import * as XLSX from 'xlsx';

export interface SheetMetadata {
  logical: string;
  physical: string;
  rowCount: number;
}

/**
 * Parses a worksheet to find technical header definitions and extract a mapping.
 * Uses a scoring system to distinguish between table metadata and column definitions.
 */
export function parseTechnicalSheet(worksheet: XLSX.WorkSheet): Map<string, string> {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  const mapping = new Map<string, string>();

  let bestScore = -1;
  let headerRowIndex = -1;
  let logicalColIdx = -1;
  let physicalColIdx = -1;

  // Scan first 50 rows for the header
  for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
    const row = jsonData[i] || [];
    let score = 0;
    let li = -1;
    let pi = -1;

    row.forEach((cell, idx) => {
      const s = String(cell || '').toLowerCase();
      // High priority for columns mentioning 'column' or specific 'name' patterns
      if (s.includes('論理') && s.includes('名')) {
        li = idx;
        score += (s.includes('カラム') || s.includes('column')) ? 10 : 2;
      }
      if (s.includes('物理') && s.includes('名')) {
        pi = idx;
        score += (s.includes('カラム') || s.includes('column')) ? 10 : 2;
      }
      // Additional indicators
      if (s === 'no.' || s === 'no' || s === '番号') score += 2;
      if (s.includes('型') || s.includes('タイプ')) score += 2;
      if (s.includes('長') || s.includes('精度')) score += 1;
      if (s.includes('必須') || s === 'pk') score += 1;
      
      // Negative indicator: Table description info (prevents misidentifying table-level headers)
      if (s.includes('テーブル') || s.includes('table')) score -= 15;
    });

    if (li !== -1 && pi !== -1 && score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
      logicalColIdx = li;
      physicalColIdx = pi;
    }
  }

  if (headerRowIndex !== -1) {
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      const logical = String(row[logicalColIdx] || '').trim();
      const physical = String(row[physicalColIdx] || '').trim();
      if (logical && physical) {
        mapping.set(logical, physical); // Store as Logical -> Physical
      }
    }
  } else {
    // Fallback logic for simple sheets without complex headers
    jsonData.forEach(row => {
      if (row.length >= 2) {
        const logical = String(row[0] || '').trim();
        const physical = String(row[1] || '').trim();
        if (logical && physical && logical.length < 200) {
          mapping.set(logical, physical);
        }
      }
    });
  }

  return mapping;
}

/**
 * Extracts basic metadata (logical/physical names) from a technical sheet.
 */
export function extractSheetMetadata(worksheet: XLSX.WorkSheet): SheetMetadata {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  let logical = '';
  let physical = '';
  let rowCount = 0;

  if (jsonData.length >= 2) {
    const row1 = jsonData[0] || []; // Labels Row
    const row2 = jsonData[1] || []; // Data Row

    const lIdx = row1.findIndex((c: any) => String(c || '').includes('論理'));
    const pIdx = row1.findIndex((c: any) => String(c || '').includes('物理'));

    if (lIdx !== -1) logical = String(row2[lIdx] || '').trim();
    else logical = String(row2[0] || '').trim();

    if (pIdx !== -1) physical = String(row2[pIdx] || '').trim();
    else physical = String(row2[3] || row2[1] || '').trim();
  }

  // Count rows starting from Row 5 (typical technical sheet layout)
  if (jsonData.length >= 5) {
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      // A row is valid if it has content in either column 0 or 1 (Logical/Physical)
      if (row && (String(row[0] || '').trim() || String(row[1] || '').trim())) {
        rowCount++;
      }
    }
  } else {
    // Fallback row count for non-technical sheets
    rowCount = Math.max(0, jsonData.length - 1);
  }

  return { logical, physical, rowCount };
}
