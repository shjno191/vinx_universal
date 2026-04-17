const fs = require('fs');
let content = fs.readFileSync('src/components/TranslateTab.vue', 'utf8');

content = content.replace(
  `          advancedDictData.value.set(sheetKey, mapping);\n          advancedDictKeys.value.push(sheetKey);\n        } catch`,
  `          advancedDictData.value.set(sheetKey, mapping);\n          advancedDictKeys.value.push(sheetKey);\n        }\n      }\n    } catch`
);

fs.writeFileSync('src/components/TranslateTab.vue', content, 'utf8');
