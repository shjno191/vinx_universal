const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

content = content.replace(
  'const advancedDictData = ref<Map<string, Map<string, string>>>(new Map());\nconst showAdvancedModal = ref(false);',
  'const advancedDictData = ref<Map<string, Map<string, string>>>(new Map());\nconst advancedDictKeys = ref<string[]>([]);\nconst showAdvancedModal = ref(false);'
);

content = content.replace(
  'const loadAdvancedDictionaries = async () => {\n  advancedDictData.value.clear();',
  'const loadAdvancedDictionaries = async () => {\n  advancedDictData.value.clear();\n  advancedDictKeys.value = [];'
);

content = content.replace(
  'const sheetKey = `${filename}::${sheetName}`;\n            advancedDictData.value.set(sheetKey, mapping);\n          }',
  'const sheetKey = `${filename}::${sheetName}`;\n            advancedDictData.value.set(sheetKey, mapping);\n            advancedDictKeys.value.push(sheetKey);\n          }'
);

content = content.replace(
  'for (const key of advancedDictData.value.keys()) {',
  'for (const key of advancedDictKeys.value) {'
);

content = content.replace(
  'const firstMatch = Array.from(advancedDictData.value.keys()).find(k => k.startsWith(fname + \'::\'));',
  'const firstMatch = advancedDictKeys.value.find(k => k.startsWith(fname + \'::\'));'
);

content = content.replace(
  'watch(advancedTranslatePaths, (newPaths) => {\n  if (newPaths.length > 0 && !selectedAdvancedFile.value) {\n    selectedAdvancedFile.value = newPaths[0];\n  } else if (newPaths.length === 0) {\n    selectedAdvancedFile.value = \'\';\n  }\n}, { immediate: true });',
  'watch(advancedTranslatePaths, (newPaths) => {\n  if (newPaths.length === 0) {\n    selectedAdvancedFile.value = \'\';\n  } else if (selectedAdvancedFile.value && !newPaths.includes(selectedAdvancedFile.value)) {\n    selectedAdvancedFile.value = \'\';\n  }\n}, { immediate: true });'
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
console.log('Includes advancedDictKeys:', content.includes('const advancedDictKeys = ref<string[]>'));
console.log('Watcher injected:', content.includes('!newPaths.includes(selectedAdvancedFile.value)'));
