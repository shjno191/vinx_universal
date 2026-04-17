const XLSX = require('xlsx');

const excelData = [
  ['テーブル論理名', '', '', 'テーブル物理名', '', '', 'スキーマ'],
  ['分類１マスタ', '', '', 'R_BUNRUI1', '', '', ''],
  [],
  ['No.', '論理カラム名', '物理カラム名', '型', '長さ', '精度', '初期値', '必須', 'PK', '備考'],
  ['1', '分類１コード', 'BUNRUI1_CD', 'CHAR', '10', '', '', '1', '', ''],
  ['2', '有効日', 'YUKO_DT', 'CHAR', '8', '', '', '2', '', '']
];

let headerRowIndex = -1;
let logicalColIdx = -1;
let physicalColIdx = -1;

for (let i = 0; i < Math.min(excelData.length, 20); i++) {
  const row = excelData[i] || [];
  const logicalIdx = row.findIndex((c) => {
    const s = String(c || '');
    return s.includes('論理カラム名') || s.includes('論理カラ') || s.includes('論理');
  });
  const physicalIdx = row.findIndex((c) => {
    const s = String(c || '');
    return s.includes('物理カラム名') || s.includes('物理カラ') || s.includes('物理');
  });
  
  if (logicalIdx !== -1 && physicalIdx !== -1) {
    headerRowIndex = i;
    logicalColIdx = logicalIdx;
    physicalColIdx = physicalIdx;
    break;
  }
}

console.log('Header Row:', headerRowIndex);
console.log('Logical Col:', logicalColIdx);
console.log('Physical Col:', physicalColIdx);
