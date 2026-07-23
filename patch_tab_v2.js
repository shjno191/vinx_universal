const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\TranslateTab.vue';
let code = fs.readFileSync(path, 'utf8');

// 1. Destructure rebuildTechDictionaryCache
const oldDestructure = 'const {';
const newDestructure = 'const { rebuildTechDictionaryCache, loadTechDictionaryCache, ';
if (code.includes('const {') && !code.includes('rebuildTechDictionaryCache')) {
    code = code.replace(/const \{\s*selectedFiles/, 'const { rebuildTechDictionaryCache, loadTechDictionaryCache, selectedFiles');
}

// 2. Modify refreshBaseDictionary
const oldRefresh = `const refreshBaseDictionary = async () => {
  if (isRefreshingBase.value) return;
  isRefreshingBase.value = true;
  await loadDictionaryData();
  rebuildBaseDictionaryCache();
  updateCachedWords();
  isRefreshingBase.value = false;
};`;

const newRefresh = `const refreshBaseDictionary = async () => {
  if (isRefreshingBase.value) return;
  isRefreshingBase.value = true;
  await loadDictionaryData();
  rebuildBaseDictionaryCache();
  
  await rebuildTechDictionaryCache();
  
  updateCachedWords();
  isRefreshingBase.value = false;
};`;

if (code.includes(oldRefresh)) {
    code = code.replace(oldRefresh, newRefresh);
} else {
    // Fallback if formatting is slightly different
    code = code.replace('rebuildBaseDictionaryCache();\\n  updateCachedWords();', 'rebuildBaseDictionaryCache();\\n  await rebuildTechDictionaryCache();\\n  updateCachedWords();');
}

fs.writeFileSync(path, code, 'utf8');
console.log('TranslateTab.vue patched for refresh button');
