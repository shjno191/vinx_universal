import { alignCsv } from '../packages/plugins/editor/src/utils/csv-helper.ts';

const input = `修正区分,ユーザID,ユーザ名,有効日,パスワード,有効期間,カナ,法人,店舗,部署,分類1,取引先,チーム,メール,権限ID
0,QA0001,テスト太郎,20261001,Passw0rd!,90,ﾃｽﾄﾀﾛｳ,01,00001,,001,00046800,,,Center
0,QA0002,テスト花子,20261001,Passw0rd!,90,ﾃｽﾄﾊﾅｺ,01,00001,,ABC,00046800,,,Center
0,QA0003,テスト次郎,20261001,Passw0rd!,90,ﾃｽﾄｼﾞﾛｳ,01,00001,,1234,00046800,,,Center
0,QA0004,テスト三郎,20261001,Passw0rd!,90,ﾃｽﾄｻﾌﾞﾛｳ,01,00001,,999,00046800,,,Center`;

const aligned = alignCsv(input);
const lines = aligned.text.split('\n');

console.log('--- Current Aligned Output ---');
console.log(aligned.text);

// Helper to compute visual width of line up to column delimiter
function getCharVisualWidth(codePoint) {
  if (codePoint < 32 || (codePoint >= 0x7F && codePoint < 0xA0)) return 0;
  if (codePoint >= 0xFF61 && codePoint <= 0xFF9F) return 1; // Halfwidth Katakana
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115F) ||
    (codePoint >= 0x2E80 && codePoint <= 0x9FFF) ||
    (codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0xFF01 && codePoint <= 0xFF60) ||
    (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
  ) return 2;
  return 1;
}

function getVisualWidth(str) {
  let w = 0;
  for (const c of str) w += getCharVisualWidth(c.codePointAt(0) || 0);
  return w;
}

// Check if all delimiters in column 0, 1, 2 are at the exact same visual position across all lines
let hasError = false;
const delimiterPositionsPerLine = lines.map(line => {
  const parts = line.split(' , ');
  let currentPos = 0;
  const positions = [];
  for (let i = 0; i < parts.length - 1; i++) {
    currentPos += getVisualWidth(parts[i]);
    positions.push(currentPos);
    currentPos += getVisualWidth(' , ');
  }
  return positions;
});

const numDelims = delimiterPositionsPerLine[0].length;
for (let d = 0; d < numDelims; d++) {
  const expectedPos = delimiterPositionsPerLine[0][d];
  for (let l = 1; l < lines.length; l++) {
    const actualPos = delimiterPositionsPerLine[l][d];
    if (actualPos !== expectedPos) {
      console.error(`MISALIGNMENT at delimiter index ${d} (Line 1 has visual col ${expectedPos}, but Line ${l + 1} has visual col ${actualPos})`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.log('\n>>> TEST FAILED: Columns are NOT visually aligned due to East Asian width differences.');
  process.exit(1);
} else {
  console.log('\n>>> TEST PASSED: All columns are visually aligned!');
  process.exit(0);
}
