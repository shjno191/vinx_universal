const XLSX = require('xlsx');
const p = 'C:/Users/09204113161/OneDrive - 株式会社ヴィンクス/Dang Sieu\'s files - Kaizen/06.【製品投資】マルチテナント化対応/11.外部設計/06.ＤＢ設計書/03.ＥＲ図・テーブル定義書/02.テーブル定義書/02.マスタ管理.xlsx';
const wb = XLSX.readFile(p);
const sheetName = 'R_SYOHIN';
const worksheet = wb.Sheets[sheetName];

const jpCol = 'C';
const physCol = 'B';
const startRow = 5;

const mapping = new Map();
const rangeStr = worksheet['!ref'];
if (rangeStr) {
    const range = XLSX.utils.decode_range(rangeStr);
    const endRow = range.e.r + 1;
    for (let r = startRow; r <= endRow; r++) {
        const jpCell = worksheet[`${jpCol}${r}`];
        const enCell = worksheet[`${physCol}${r}`];
        
        const logical = jpCell && jpCell.v ? String(jpCell.v).trim() : '';
        const physical = enCell && enCell.v ? String(enCell.v).trim() : '';
        
        if (logical && physical && logical !== physical && logical.length < 200) {
            mapping.set(logical, physical);
        }
    }
}
console.log(Object.fromEntries(mapping));
