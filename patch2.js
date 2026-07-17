const fs = require('fs');
const filePath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translate\\\\TranslationPane.vue';
let content = fs.readFileSync(filePath, 'utf-8');

const target = "const sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });\r\nconst sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });";
const replacement = "const sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });";

content = content.replace(target, replacement);

// Fallback for LF
const targetLF = "const sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });\nconst sheetContextMenu = ref({ show: false, x: 0, y: 0, logical: '', physical: '', fullKey: '' });";
content = content.replace(targetLF, replacement);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Duplicate removed');
