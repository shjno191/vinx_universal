const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\sheet-parser.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Update extractSheetMetadata signature
if (code.includes('export function extractSheetMetadata(worksheet: XLSX.WorkSheet): SheetMetadata {')) {
    code = code.replace('export function extractSheetMetadata(worksheet: XLSX.WorkSheet): SheetMetadata {', 'export function extractSheetMetadata(worksheet: XLSX.WorkSheet, config?: SheetConfig): SheetMetadata {');
}

// 2. Overhaul extractSheetMetadata logic
const oldExtractLogic = /export function extractSheetMetadata.*?(?=export function parseTechnicalSheet)/s;
const newExtractLogic = `export function extractSheetMetadata(worksheet: XLSX.WorkSheet, config?: SheetConfig): SheetMetadata {
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

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  return {
    logicalName,
    physicalName,
    rowCount: range.e.r + 1
  };
}

`;

if (oldExtractLogic.test(code)) {
    code = code.replace(oldExtractLogic, newExtractLogic);
} else {
    console.log("Could not replace extractSheetMetadata");
}

fs.writeFileSync(path, code, 'utf8');
console.log("sheet-parser.ts extractSheetMetadata updated");
