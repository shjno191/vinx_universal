import * as XLSX from 'xlsx';

export interface SheetMetadata {
  logicalName: string;
  physicalName: string;
  rowCount: number;
}

export interface SheetConfig {
  jpCol?: string;
  physCol?: string;
  startRow?: number;
  jpNameCell?: string;
  enNameCell?: string;
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
export function parseTechnicalSheet(worksheet: XLSX.WorkSheet, config?: SheetConfig): Map<string, string> {
  const mapping = new Map<string, string>();
  
  // 1. Explicit Configuration Mode
  if (config?.jpCol && config?.physCol) {
    const jpCol = config.jpCol.trim().toUpperCase();
    const physCol = config.physCol.trim().toUpperCase();
    const startRow = config.startRow || 1;

    const rangeStr = worksheet['!ref'];
    if (!rangeStr) return mapping;
    
    const range = XLSX.utils.decode_range(rangeStr);
    const endRow = range.e.r + 1; // 1-indexed (decode_range gives 0-indexed)

    for (let r = startRow; r <= endRow; r++) {
      const jpCell = worksheet[`${jpCol}${r}`];
      const enCell = worksheet[`${physCol}${r}`];
      
      const logical = jpCell && jpCell.v ? String(jpCell.v).trim() : '';
      const physical = enCell && enCell.v ? String(enCell.v).trim() : '';
      
      if (logical && physical && logical !== physical && logical.length < 200) {
        mapping.set(logical, physical);
      }
    }
    return mapping;
  }

  // 2. Automatic Detection Mode
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
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
export function extractSheetMetadata(worksheet: XLSX.WorkSheet, config?: SheetConfig): SheetMetadata {
  let logicalName = '';
  let physicalName = '';

  const getCellValue = (cellAddress: string) => {
    const cell = worksheet[cellAddress];
    return cell ? (cell.v ? cell.v.toString().trim() : '') : '';
  };

  // Default to A2 for logical (JP) and D2 for physical (EN) if not provided
  const logicalCell = config?.jpNameCell || 'A2';
  const physicalCell = config?.enNameCell || 'D2';

  logicalName = getCellValue(logicalCell);
  physicalName = getCellValue(physicalCell);

  let rowCount = 0;
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    rowCount = range.e.r + 1;
  }

  return {
    logicalName,
    physicalName,
    rowCount
  };
}