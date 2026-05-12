import * as XLSX from 'xlsx';

export interface SheetMetadata {
  logical: string;
  physical: string;
  rowCount: number;
}

/**
 * Helper to check if a string looks like a physical DB name (identifiers, underscores, caps).
 */
function isPhysicalLike(s: string): boolean {
  if (!s || s.length < 2) return false;
  return /^[A-Z0-9_$#.]+$/.test(s);
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
  // Support multiple logical/physical column pairs
  let columnPairs: Array<{ li: number, pi: number }> = [];

  // Scan first 50 rows for the header
  for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
    const row = jsonData[i] || [];
    let score = 0;
    const currentPairs: Array<{ li: number, pi: number }> = [];
    
    // We search for logical/physical markers
    let tempLi: number[] = [];
    let tempPi: number[] = [];

    row.forEach((cell, idx) => {
      const s = String(cell || '').toLowerCase();
      // High priority for columns mentioning 'column' or specific 'name' patterns
      if (s.includes('論理') && s.includes('名')) {
        tempLi.push(idx);
        score += (s.includes('カラム') || s.includes('column') || s.includes('項目')) ? 10 : 2;
      }
      if (s.includes('物理') && s.includes('名')) {
        tempPi.push(idx);
        score += (s.includes('カラム') || s.includes('column') || s.includes('項目')) ? 10 : 2;
      }
      // Additional indicators
      if (s === 'no.' || s === 'no' || s === '番号') score += 2;
      if (s.includes('型') || s.includes('タイプ')) score += 2;
      if (s.includes('長') || s.includes('精度')) score += 1;
      if (s.includes('必須') || s === 'pk') score += 1;
      
      // Negative indicator: Table description info (prevents misidentifying table-level headers)
      if (s.includes('テーブル') || s.includes('table')) score -= 15;
    });

    // Pair up closest logical/physical columns
    if (tempLi.length > 0 && tempPi.length > 0) {
      // Simple heuristic: pair them based on proximity
      tempLi.forEach(li => {
        let nearestPi = -1;
        let minDist = Infinity;
        tempPi.forEach(pi => {
          const dist = Math.abs(li - pi);
          if (dist < minDist) {
            minDist = dist;
            nearestPi = pi;
          }
        });
        if (nearestPi !== -1) {
          currentPairs.push({ li, pi });
        }
      });
      
      // Ensure we also pair any unpaired physical columns
      tempPi.forEach(pi => {
        if (!currentPairs.some(p => p.pi === pi)) {
          let nearestLi = -1;
          let minDist = Infinity;
          tempLi.forEach(li => {
            const dist = Math.abs(li - pi);
            if (dist < minDist) {
              minDist = dist;
              nearestLi = li;
            }
          });
          if (nearestLi !== -1) {
             currentPairs.push({ li: nearestLi, pi });
          }
        }
      });

      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
        columnPairs = currentPairs;
      }
    }
  }

  if (headerRowIndex !== -1) {
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      columnPairs.forEach(pair => {
        const logical = String(row[pair.li] || '').trim();
        const physical = String(row[pair.pi] || '').trim();
        if (logical && physical && logical !== physical) {
          mapping.set(logical, physical); // Store as Logical -> Physical
        }
      });
    }
  } else {
    // Fallback logic improved for DB List format
    // Detect if it's a DB List format (5+ columns with repeating table/column info)
    let dbListScore = 0;
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
      const row = jsonData[i] || [];
      if (row.length >= 5 && isPhysicalLike(String(row[1])) && isPhysicalLike(String(row[3]))) {
        dbListScore++;
      }
    }

    if (dbListScore > 3) {
      jsonData.forEach(row => {
        if (row.length >= 5) {
          const tableJP = String(row[0] || '').trim();
          const tableEN = String(row[1] || '').trim();
          const colEN = String(row[3] || '').trim();
          const colJP = String(row[4] || '').trim();
          if (tableJP && tableEN) mapping.set(tableJP, tableEN);
          if (colJP && colEN) mapping.set(colJP, colEN);
        }
      });
    } else {
      // Simple 2-column fallback
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

  // Search for table names in the first 20 rows
  for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
    const row = jsonData[i] || [];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim();
      if (cell.includes('テーブル') && cell.includes('名')) {
        const val = String(row[j + 1] || '').trim();
        if (val) {
          if (cell.includes('論理')) logical = val;
          if (cell.includes('物理')) physical = val;
        }
      }
    }
    if (logical && physical) break;
  }

  // Fallback for DB List format
  if (!logical || !physical) {
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
      const row = jsonData[i] || [];
      if (row.length >= 5 && isPhysicalLike(String(row[1])) && isPhysicalLike(String(row[3]))) {
        logical = String(row[0] || '').trim();
        physical = String(row[1] || '').trim();
        break;
      }
    }
  }

  // Fallback old logic if not found
  if (!logical || !physical) {
    if (jsonData.length >= 2) {
      const row1 = jsonData[0] || [];
      const row2 = jsonData[1] || [];
      const lIdx = row1.findIndex((c: any) => String(c || '').includes('論理'));
      const pIdx = row1.findIndex((c: any) => String(c || '').includes('物理'));
      if (lIdx !== -1 && !logical) logical = String(row2[lIdx] || '').trim();
      if (pIdx !== -1 && !physical) physical = String(row2[pIdx] || '').trim();
    }
  }

  // Count rows starting from Row 5 (typical technical sheet layout)
  if (jsonData.length >= 5) {
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && (String(row[0] || '').trim() || String(row[1] || '').trim())) {
        rowCount++;
      }
    }
  } else {
    rowCount = Math.max(0, jsonData.length - 1);
  }

  return { logical, physical, rowCount };
}
