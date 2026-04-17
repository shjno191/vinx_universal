const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

// 1. Rename modal title
content = content.replace(
  '<span>Advanced Import Management</span>',
  '<span>Import database file excel</span>'
);

// 2. Fix modal info text and encoding
content = content.replace(
  /<p class="modal-info">Load specialized Excel files \(mapping <b>[^<]+<\/b> to <b>[^<]+<\/b>\)\. Takes priority over main dict\.<\/p>/,
  '<p class="modal-info">Load specialized Excel files (mapping <b>論理カラム名</b> to <b>物理カラム名</b>). Takes priority over main dict.</p>'
);

// 3. Fix logic scan encoding (logicalIdx)
content = content.replace(
  /return s\.includes\('_J\?\?\?\?'\) \|\| s\.includes\('論理\?\?\?ラ\?\?'\) \|\| s\.includes\('論理\?\?\?ラ'\);/g,
  "return s.includes('論理カラム名') || s.includes('論理カラ') || s.includes('論理');"
);

// 4. Fix logic scan encoding (physicalIdx)
content = content.replace(
  /return s\.includes\('\?\?J\?\?\?\?'\) \|\| s\.includes\('物\?\?\?\?\?ラ\?\?'\) \|\| s\.includes\('物\?\?\?\?\?ラ'\);/g,
  "return s.includes('物理カラム名') || s.includes('物理カラ') || s.includes('物理');"
);

// 5. Another attempt at the logic scan if the above regex failed due to varying broken bits
content = content.replace(
  /return s\.includes\('[^']+'\) \|\| s\.includes\('[^']+'\) \|\| s\.includes\('[^']+'\);\s*}\);\s*const physicalIdx/g,
  "return s.includes('論理カラム名') || s.includes('論理カラ') || s.includes('論理');\n            });\n            const physicalIdx"
);

content = content.replace(
  /const physicalIdx = row\.findIndex\(\(c: any\) => \{\s*const s = String\(c \|\| ''\);\s*return s\.includes\('[^']+'\) \|\| s\.includes\('[^']+'\) \|\| s\.includes\('[^']+'\);\s*}\);/g,
  "const physicalIdx = row.findIndex((c: any) => {\n              const s = String(c || '');\n              return s.includes('物理カラム名') || s.includes('物理カラ') || s.includes('物理');\n            });"
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
console.log('Final fix applied.');
console.log('Title Fixed:', content.includes('Import database file excel'));
console.log('Logic Fixed:', content.includes('論理カラム名'));
