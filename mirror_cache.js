const fs = require('fs');
const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\useTranslateManager.ts';
let code = fs.readFileSync(path, 'utf8');

// --- 1. Replace getTechCachePath with getCacheMirrorDir ---
const oldGetTechPath = `  const getTechCachePath = async () => {
    const configDir = await invoke<string>('get_app_config_dir');
    return \`\${configDir}/tech_dictionary.json\`.replace(/\\\\\\\\/g, '/');
  };`;

const newGetMirrorDir = `  /**
   * Gets the AppData mirror directory for a given source folder.
   * e.g., "C:/Users/.../02.テーブル定義書" → "%APPDATA%/vinx_universal/cache/02.テーブル定義書"
   */
  const getCacheMirrorDir = async (sourceFolderPath: string): Promise<string> => {
    const configDir = await invoke<string>('get_app_config_dir');
    const folderName = sourceFolderPath.replace(/\\\\/g, '/').replace(/\\/$/, '').split('/').pop() || 'default';
    return \`\${configDir}/cache/\${folderName}\`.replace(/\\\\/g, '/');
  };`;

if (code.includes(oldGetTechPath)) {
    code = code.replace(oldGetTechPath, newGetMirrorDir);
    console.log("Replaced getTechCachePath with getCacheMirrorDir");
} else {
    // Try trimmed whitespace insensitive approach
    const regex = /const getTechCachePath = async \(\) => \{[\s\S]*?return.*tech_dictionary\.json.*;\s*\};/m;
    if (regex.test(code)) {
        code = code.replace(regex, newGetMirrorDir.trim());
        console.log("Replaced getTechCachePath via regex");
    } else {
        console.log("WARNING: Could not find getTechCachePath!");
    }
}

// --- 2. Replace loadTechDictionaryCache ---
const oldLoadCache = /const loadTechDictionaryCache = async \(\) => \{[\s\S]*?\};(?=\s*const rebuildTechDictionaryCache)/m;

const newLoadCache = `const loadTechDictionaryCache = async () => {
    try {
      const newMap = new Map<string, Map<string, string>>();
      const newMeta: Record<string, SheetMetadata> = {};
      let totalSheets = 0;

      // Collect all source folders from active groups
      const sourceFolders = new Set<string>();
      for (const group of advancedTranslateGroups.value) {
        if (!group.active) continue;
        for (const p of group.paths) {
          if (p.type === 'folder') sourceFolders.add(p.path.replace(/\\\\/g, '/'));
        }
      }

      for (const sourceFolder of sourceFolders) {
        try {
          const mirrorDir = await getCacheMirrorDir(sourceFolder);
          const jsonFiles = await invoke<string[]>('list_files_in_dir', { path: mirrorDir, extension: 'json' });

          for (const jsonFile of jsonFiles) {
            try {
              const content = await invoke<string>('read_file_content', { path: jsonFile });
              const fileData = JSON.parse(content) as Record<string, any>;

              for (const [sheetName, sheetData] of Object.entries(fileData)) {
                const fullKey = sheetData.fullKey || \`\${sheetData.filePath}::\${sheetName}\`;
                newMap.set(fullKey, new Map(Object.entries(sheetData.columns || {})));
                newMeta[fullKey] = { logicalName: sheetData.jp, physicalName: sheetData.en, rowCount: sheetData.rowCount || 0 };
                totalSheets++;
              }
            } catch (e) {
              console.warn(\`[TranslateManager] Skip invalid JSON: \${jsonFile}\`, e);
            }
          }
        } catch (e) {
          console.warn(\`[TranslateManager] No mirror dir for: \${sourceFolder}\`, e);
        }
      }

      advancedDictData.value = newMap;
      sheetMetadata.value = newMeta;
      console.log(\`[TranslateManager] Loaded tech dictionary from mirror cache (\${totalSheets} sheets)\`);
      return totalSheets > 0;
    } catch (e) {
      console.error("[TranslateManager] Failed to load tech dictionary cache:", e);
      return false;
    }
  };`;

if (oldLoadCache.test(code)) {
    code = code.replace(oldLoadCache, newLoadCache);
    console.log("Replaced loadTechDictionaryCache");
} else {
    console.log("WARNING: Could not find loadTechDictionaryCache!");
}

// --- 3. Replace rebuildTechDictionaryCache ---
const oldRebuild = /const rebuildTechDictionaryCache = async \(\) => \{[\s\S]*?\};(?=\s*const loadSingleSheet)/m;

const newRebuild = `const rebuildTechDictionaryCache = async () => {
    try {
      startLoading("Rebuilding Technical Dictionary Cache...");

      // Collect all source folders from active groups
      const sourceFolders = new Set<string>();
      for (const group of advancedTranslateGroups.value) {
        if (!group.active) continue;
        for (const p of group.paths) {
          if (p.type === 'folder') sourceFolders.add(p.path.replace(/\\\\/g, '/'));
        }
      }

      // Group excel files by their parent folder
      for (const sourceFolder of sourceFolders) {
        const mirrorDir = await getCacheMirrorDir(sourceFolder);

        // Create mirror directory in AppData
        await invoke('create_dir_all', { path: mirrorDir });
        console.log(\`[TranslateManager] Created mirror dir: \${mirrorDir}\`);

        // Get all excel files in this source folder
        const excelFiles = excelFilesInFolder.value.filter(f => {
          const normalized = f.replace(/\\\\/g, '/');
          return normalized.startsWith(sourceFolder);
        });

        for (const filePath of excelFiles) {
          try {
            const b64 = await readBinary(filePath);
            const workbook = XLSX.read(b64, { type: 'array' });
            const config = getConfigForFile(filePath);

            const fileJson: Record<string, any> = {};

            for (const sheetName of workbook.SheetNames) {
              // Skip sheets with Japanese characters
              if (/[\\u3000-\\u303F\\u3040-\\u309F\\u30A0-\\u30FF\\uFF00-\\uFFEF\\u4E00-\\u9FAF]/.test(sheetName)) {
                continue;
              }

              const worksheet = workbook.Sheets[sheetName];
              const meta = extractSheetMetadata(worksheet, config);
              const mapping = parseTechnicalSheet(worksheet, config);

              fileJson[sheetName] = {
                fullKey: \`\${filePath}::\${sheetName}\`,
                filePath,
                jp: meta.logicalName,
                en: meta.physicalName,
                rowCount: meta.rowCount,
                columns: Object.fromEntries(mapping)
              };
            }

            // Write JSON file with same name as Excel file
            const fileName = filePath.replace(/\\\\/g, '/').split('/').pop()?.replace(/\\.xlsx?$/i, '') || 'unknown';
            const jsonPath = \`\${mirrorDir}/\${fileName}.json\`;
            await invoke('save_file_content', { path: jsonPath, content: JSON.stringify(fileJson, null, 2) });
            console.log(\`[TranslateManager] Saved cache: \${jsonPath}\`);
          } catch (e) {
            console.error(\`[TranslateManager] Failed to parse \${filePath}:\`, e);
          }
        }
      }

      await loadTechDictionaryCache();
    } catch (e) {
      console.error("[TranslateManager] Failed to rebuild tech dictionary cache:", e);
    } finally {
      stopLoading();
    }
  };`;

if (oldRebuild.test(code)) {
    code = code.replace(oldRebuild, newRebuild);
    console.log("Replaced rebuildTechDictionaryCache");
} else {
    console.log("WARNING: Could not find rebuildTechDictionaryCache!");
}

fs.writeFileSync(path, code, 'utf8');
console.log("Done! useTranslateManager.ts updated with mirror folder architecture.");
