const fs = require('fs');

// === 1. TranslationPane.vue ===
const panePath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translate\\\\TranslationPane.vue';
let pane = fs.readFileSync(panePath, 'utf8');

// Add refreshTechnical emit
if (!pane.includes("refreshTechnical")) {
    pane = pane.replace(
        "(e: 'refreshFiles'): void;",
        "(e: 'refreshFiles'): void;\n  (e: 'refreshTechnical'): void;"
    );
    console.log("Added refreshTechnical emit");
}

// Add Database button after RefreshCw button
const refreshBtn = /(<button @click="emit\('refreshFiles'\)"[^>]+>.*?<\/button>)/s;
if (refreshBtn.test(pane)) {
    pane = pane.replace(refreshBtn, (match) => {
        if (pane.includes("refreshTechnical") && pane.includes("icon-btn-tech")) return match; // already added
        return match + '\n            <button @click="emit(\'refreshTechnical\')" class="icon-btn-ghost icon-btn-tech" title="Rebuild Technical Cache" v-html="Icons.Database"></button>';
    });
    console.log("Added refreshTechnical button");
}

// Rename tooltip of existing button 
pane = pane.replace('title="Refresh Files"', 'title="Refresh Base Dictionary"');

fs.writeFileSync(panePath, pane, 'utf8');

// === 2. TranslateTab.vue ===
const tabPath = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\TranslateTab.vue';
let tab = fs.readFileSync(tabPath, 'utf8');

// Destructure rebuildTechDictionaryCache and loadTechDictionaryCache 
if (!tab.includes('rebuildTechDictionaryCache')) {
    tab = tab.replace(
        'rebuildBaseDictionaryCache,\n  saveDictionaryFile,',
        'rebuildBaseDictionaryCache,\n  rebuildTechDictionaryCache,\n  loadTechDictionaryCache,\n  saveDictionaryFile,'
    );
    console.log("Added rebuildTechDictionaryCache to destructure");
}

// Add handleRefreshTechnical function after handleRefreshBase
const handleRefreshBase = `const handleRefreshBase = async () => {`;
if (tab.includes(handleRefreshBase) && !tab.includes('handleRefreshTechnical')) {
    // Find the end of handleRefreshBase function
    const regex = /(const handleRefreshBase = async \(\) => \{[\s\S]*?\};)/m;
    tab = tab.replace(regex, (match) => {
        return match + `

const handleRefreshTechnical = async () => {
  isRefreshingTech.value = true;
  try {
    await rebuildTechDictionaryCache();
    showToast('Technical Dictionary cache rebuilt!');
  } catch (e) {
    showToast('Failed to rebuild Technical Dictionary cache.');
  } finally {
    isRefreshingTech.value = false;
  }
};`;
    });
    console.log("Added handleRefreshTechnical");
}

// Add isRefreshingTech ref 
if (!tab.includes('isRefreshingTech')) {
    tab = tab.replace(
        'const showDictModal = ref(false);',
        'const showDictModal = ref(false);\nconst isRefreshingTech = ref(false);'
    );
    console.log("Added isRefreshingTech ref");
}

// Update onMounted — use smart init (load cache only if exists, don't rebuild)
const oldOnMounted = `  // If we already have paths but no files listed, trigger a scan
  if (advancedTranslatePaths.value.length > 0 && excelFilesInFolder.value.length === 0) {
    console.log('[TranslateTab] Initial scan for files...');
    loadFilesFromMultipleFolders(advancedTranslatePaths.value);
  }`;
const newOnMounted = `  // If we already have paths but no files listed, trigger a scan
  if (advancedTranslatePaths.value.length > 0 && excelFilesInFolder.value.length === 0) {
    console.log('[TranslateTab] Initial scan for files...');
    await loadFilesFromMultipleFolders(advancedTranslatePaths.value);
  }
  // Smart init: Only load tech cache if it already exists (don't rebuild on startup)
  loadTechDictionaryCache();`;

if (tab.includes(oldOnMounted)) {
    tab = tab.replace(oldOnMounted, newOnMounted);
    console.log("Updated onMounted with smart init");
} else {
    console.log("WARNING: Could not find onMounted block");
}

// Add @refreshTechnical handler to TranslationPane component
if (!tab.includes("@refreshTechnical")) {
    tab = tab.replace(
        '@refreshFiles="() => loadFilesFromMultipleFolders(advancedTranslatePaths, true)"',
        '@refreshFiles="() => loadFilesFromMultipleFolders(advancedTranslatePaths, true)"\n        @refreshTechnical="handleRefreshTechnical"'
    );
    console.log("Added @refreshTechnical handler");
}

fs.writeFileSync(tabPath, tab, 'utf8');

console.log("\\nDone! All changes applied successfully.");
