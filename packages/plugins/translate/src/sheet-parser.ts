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
  // Must contain at least one letter, and only allowed characters
  return /^[A-Za-z0-9_$#.]+$/.test(s) && /[A-Za-z]/.test(s);
}

/**
 * Parses a worksheet to find technical definitions and extract a mapping.
 * Uses content-based column profiling to automatically identify Japanese (Logical) 
 * and English (Physical) columns, making it immune to formatting changes.
 */
export function parseTechnicalSheet(worksheet: XLSX.WorkSheet): Map<string, string> {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  const mapping = new Map<string, string>();
  
  if (!jsonData || jsonData.length === 0) return mapping;

  const colProfiles: Record<number, { jp: number, en: number, total: number }> = {};
  
  // 1. Profile columns based on data
  const sampleLimit = Math.min(jsonData.length, 100);
  for (let i = 0; i < sampleLimit; i++) {
    const row = jsonData[i] || [];
    row.forEach((cell, colIdx) => {
      const s = String(cell || '').trim();
      if (!s) return;
      
      if (!colProfiles[colIdx]) colProfiles[colIdx] = { jp: 0, en: 0, total: 0 };
      colProfiles[colIdx].total++;
      
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(s)) {
        // Exclude very long descriptions
        if (s.length < 50) {
          colProfiles[colIdx].jp++;
        }
      } else if (isPhysicalLike(s)) {
        colProfiles[colIdx].en++;
      }
    });
  }

  // 2. Identify candidate columns
  const jpCols: number[] = [];
  const enCols: number[] = [];
  
  for (const colIdxStr in colProfiles) {
    const colIdx = parseInt(colIdxStr);
    const prof = colProfiles[colIdx];
    
    // A column is "mostly Japanese" if > 15% of its cells are JP and it has at least 2 JP cells
    if (prof.jp > prof.total * 0.15 && prof.jp >= 2) {
      jpCols.push(colIdx);
    }
    // A column is "mostly English" if > 15% of its cells are EN and it has at least 2 EN cells
    if (prof.en > prof.total * 0.15 && prof.en >= 2) {
      enCols.push(colIdx);
    }
  }

  // 3. Pair them up by proximity
  const pairs: Array<{ jp: number, en: number }> = [];
  
  jpCols.forEach(jpIdx => {
    let bestEn = -1;
    let minDist = Infinity;
    enCols.forEach(enIdx => {
      const dist = Math.abs(jpIdx - enIdx);
      if (dist < minDist) {
        minDist = dist;
        bestEn = enIdx;
      }
    });
    if (bestEn !== -1) {
      pairs.push({ jp: jpIdx, en: bestEn });
    }
  });

  // Ensure all EN cols are paired to capture everything (like DB list format)
  enCols.forEach(enIdx => {
    if (!pairs.some(p => p.en === enIdx)) {
      let bestJp = -1;
      let minDist = Infinity;
      jpCols.forEach(jpIdx => {
        const dist = Math.abs(jpIdx - enIdx);
        if (dist < minDist) {
          minDist = dist;
          bestJp = jpIdx;
        }
      });
      if (bestJp !== -1) {
        pairs.push({ jp: bestJp, en: enIdx });
      }
    }
  });

  // Remove duplicate pairs
  const uniquePairs = new Set<string>();
  const finalPairs: Array<{ jp: number, en: number }> = [];
  pairs.forEach(p => {
    const key = `${p.jp}-${p.en}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.add(key);
      finalPairs.push(p);
    }
  });

  // 4. Extract data using pairs
  if (finalPairs.length > 0) {
    jsonData.forEach(row => {
      finalPairs.forEach(pair => {
        const logical = String(row[pair.jp] || '').trim();
        const physical = String(row[pair.en] || '').trim();
        if (logical && physical && logical !== physical && logical.length < 200) {
           mapping.set(logical, physical);
        }
      });
    });
  } else {
    // 5. Ultimate Fallback: just search row by row if column profiling yielded nothing
    jsonData.forEach(row => {
      let tempJp = '';
      let tempEn = '';
      row.forEach(cell => {
        const s = String(cell || '').trim();
        if (s && s.length < 50) {
          if (!tempJp && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(s)) {
            tempJp = s;
          } else if (!tempEn && isPhysicalLike(s)) {
            tempEn = s;
          }
        }
      });
      if (tempJp && tempEn && tempJp !== tempEn) {
        mapping.set(tempJp, tempEn);
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
             if (!logical && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(val)) logical = val;
             else if (!physical && isPhysicalLike(val)) physical = val;
           }
        }
      }
    }
    if (logical && physical) break;
  }

  // Fallback: Guess from the first valid JP/EN pair we find
  if (!logical || !physical) {
    for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
      const row = jsonData[i] || [];
      let tempJp = '';
      let tempEn = '';
      for (const cell of row) {
        const s = String(cell || '').trim();
        if (s.length > 0 && s.length < 100) {
          if (!tempJp && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(s)) tempJp = s;
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

  // Count rows starting from Row 5
  if (jsonData.length >= 5) {
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      // A row is valid if it has at least one string cell
      if (row && row.some((c: any) => String(c || '').trim())) {
        rowCount++;
      }
    }
  } else {
    rowCount = Math.max(0, jsonData.length - 1);
  }

  return { logical, physical, rowCount };
}
