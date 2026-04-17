const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

content = content.replace(
  /const logicalIdx = row\.findIndex\(\(c: any\) => \{\s*const s = String\(c \|\| ''\);\s*return s\.includes\([^;]+\);\s*\}\);/g,
  `const logicalIdx = row.findIndex((c: any) => {\n              const s = String(c || '');\n              return s.includes('論理カラム名') || s.includes('論理カラ') || s.includes('論理');\n            });`
);

content = content.replace(
  /const physicalIdx = row\.findIndex\(\(c: any\) => \{\s*const s = String\(c \|\| ''\);\s*return s\.includes\([^;]+\);\s*\}\);/g,
  `const physicalIdx = row.findIndex((c: any) => {\n              const s = String(c || '');\n              return s.includes('物理カラム名') || s.includes('物理カラ') || s.includes('物理');\n            });`
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
console.log('Includes 論理カラム名:', content.includes('論理カラム名'));
