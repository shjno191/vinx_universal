const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

content = content.replace(
  /const advancedDictData = ref<Map<string, Map<string, string>>>\(new Map\(\)\);[\s\S]*?const showAdvancedModal = ref\(false\);/,
  `const advancedDictData = ref<Map<string, Map<string, string>>>(new Map());
const advancedDictKeys = ref<string[]>([]);
const showAdvancedModal = ref(false);`
);

content = content.replace(
  /const loadAdvancedDictionaries = async \(\) => \{\n\s*advancedDictData\.value\.clear\(\);/,
  `const loadAdvancedDictionaries = async () => {\n  advancedDictData.value.clear();\n  advancedDictKeys.value = [];`
);

content = content.replace(
  /advancedDictData\.value\.set\(sheetKey, mapping\);\n\s*\}/g,
  `advancedDictData.value.set(sheetKey, mapping);\n            advancedDictKeys.value.push(sheetKey);\n          }`
);

content = content.replace(
  /for \(const key of advancedDictData\.value\.keys\(\)\) \{/g,
  `for (const key of advancedDictKeys.value) {`
);

content = content.replace(
  /Array\.from\(advancedDictData\.value\.keys\(\)\)\.find\(k => k\.startsWith\(fname \+ '::'\)\)/g,
  `advancedDictKeys.value.find(k => k.startsWith(fname + '::'))`
);

content = content.replace(
  /watch\(advancedTranslatePaths, \(newPaths\) => \{[\s\S]*?\}, \{ immediate: true \}\);/m,
  `watch(advancedTranslatePaths, (newPaths) => {
  if (newPaths.length === 0) {
    selectedAdvancedFile.value = '';
  } else if (selectedAdvancedFile.value && !newPaths.includes(selectedAdvancedFile.value)) {
    selectedAdvancedFile.value = '';
  }
}, { immediate: true });`
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
console.log('Includes advancedDictKeys:', content.includes('const advancedDictKeys = ref<string[]>'));
console.log('Watcher injected:', content.includes('!newPaths.includes(selectedAdvancedFile.value)'));
