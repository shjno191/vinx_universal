const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

// Inject the push logic
content = content.replace(
  /advancedDictData\.value\.set\(sheetKey, mapping\);[\s\S]{0,50}\}/g,
  `advancedDictData.value.set(sheetKey, mapping);\n          advancedDictKeys.value.push(sheetKey);\n        }`
);

// Inject the clear logic
content = content.replace(
  /advancedDictData\.value\.clear\(\);/g,
  `advancedDictData.value.clear();\n  advancedDictKeys.value = [];`
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
console.log('Push injected:', content.includes('advancedDictKeys.value.push(sheetKey)'));
console.log('Clear injected:', content.includes('advancedDictKeys.value = []'));
