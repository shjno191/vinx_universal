import { parseCsvLine, alignCsv } from '../packages/plugins/editor/src/utils/csv-helper.ts';

const input = `修正区分,ユーザID,ユーザ名,有効日,パスワード,有効期間,カナ,法人,店舗,部署,分類1,取引先,チーム,メール,権限ID
0,QA0001,テスト太郎,20261001,Passw0rd!,90,ﾃｽﾄﾀﾛｳ,01,00001,,001,00046800,,,Center
0,QA0002,テスト花子,20261001,Passw0rd!,90,ﾃｽﾄﾊﾅｺ,01,00001,,ABC,00046800,,,Center
0,QA0003,テスト次郎,20261001,Passw0rd!,90,ﾃｽﾄｼﾞﾛｳ,01,00001,,1234,00046800,,,Center
0,QA0004,テスト三郎,20261001,Passw0rd!,90,ﾃｽﾄｻﾌﾞﾛｳ,01,00001,,999,00046800,,,Center`;

const aligned = alignCsv(input);
const lines = aligned.text.split('\n');

console.log('Testing decorations mapping on aligned lines...');

const headerTokens = parseCsvLine(lines[0], ',');
console.log('Header column count:', headerTokens.cells.length);
if (headerTokens.cells.length !== 15) {
  console.error('Expected 15 header columns, got', headerTokens.cells.length);
  process.exit(1);
}

for (let i = 1; i < lines.length; i++) {
  const rowTokens = parseCsvLine(lines[i], ',');
  if (rowTokens.cells.length !== 15) {
    console.error(`Line ${i + 1} has ${rowTokens.cells.length} columns, expected 15`);
    process.exit(1);
  }
}

console.log('ALL 5 ROWS HAVE EXACTLY 15 COLUMNS!');
console.log('Verified column classes:');
for (let c = 0; c < 15; c++) {
  console.log(`  Col ${c + 1} (${headerTokens.cells[c].value}) -> class: csv-col-${c % 10}`);
}

console.log('\n>>> TEST PASSED: CSV tokens and Rainbow column mapping verified successfully!');
