const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\sheet-parser.ts';
let code = fs.readFileSync(path, 'utf8');

const signature = 'export function extractSheetMetadata(worksheet: XLSX.WorkSheet, config?: SheetConfig): SheetMetadata {';

const newLogic = `
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
`;

// Extract the old function
const startIndex = code.indexOf(signature);
if (startIndex !== -1) {
    code = code.substring(0, startIndex) + newLogic.trim() + '\\n';
    fs.writeFileSync(path, code, 'utf8');
    console.log("extractSheetMetadata replaced successfully");
} else {
    // try the old signature without config
    const oldSig = 'export function extractSheetMetadata(worksheet: XLSX.WorkSheet): SheetMetadata {';
    const oldStartIndex = code.indexOf(oldSig);
    if (oldStartIndex !== -1) {
        code = code.substring(0, oldStartIndex) + newLogic.trim() + '\\n';
        fs.writeFileSync(path, code, 'utf8');
        console.log("extractSheetMetadata (old sig) replaced successfully");
    } else {
        console.log("Could not find extractSheetMetadata");
    }
}
