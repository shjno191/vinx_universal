const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translate\\\\TranslationPane.vue';
let code = fs.readFileSync(path, 'utf8');

// Add invoke import if not there
if (!code.includes('import { invoke }')) {
  code = code.replace(
    "import { sanitize, Icons } from '@vinx/sdk';",
    "import { sanitize, Icons } from '@vinx/sdk';\nimport { invoke } from '@tauri-apps/api/core';"
  );
}

// Add openSheetInExcel function
const oldContextFn = `const copyFromSheetContext = (type: 'logical' | 'physical') => {
  const text = type === 'logical' ? sheetContextMenu.value.logical : sheetContextMenu.value.physical;
  if (text) {
    emit('copy', text, new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
  }
  closeContextMenu();
};`;

const newContextFn = `const copyFromSheetContext = (type: 'logical' | 'physical') => {
  const text = type === 'logical' ? sheetContextMenu.value.logical : sheetContextMenu.value.physical;
  if (text) {
    emit('copy', text, new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
  }
  closeContextMenu();
};

const openSheetInExcel = async () => {
  if (sheetContextMenu.value?.fullKey) {
    const file = sheetContextMenu.value.fullKey.split('::').slice(0, -1).join('::');
    const sheetName = sheetContextMenu.value.fullKey.split('::').pop();
    try {
      emit('copy', 'Opening Excel...', new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
      await invoke('open_excel_at_sheet', { path: file, sheetName });
    } catch (e) {
      console.error(e);
      emit('copy', 'Failed to open Excel', new MouseEvent('click', { clientX: sheetContextMenu.value.x, clientY: sheetContextMenu.value.y }));
    }
  }
  closeContextMenu();
};`;
code = code.replace(oldContextFn, newContextFn);

// Add to template
const oldTemplate = `<div class="menu-item" @click="copyFromSheetContext('logical')" v-if="sheetContextMenu.logical">
          <span v-html="Icons.Copy || '📋'"></span> Copy JP name 
          <span class="context-preview">{{ sheetContextMenu.logical }}</span>
        </div>`;

const newTemplate = `<div class="menu-item" @click="copyFromSheetContext('logical')" v-if="sheetContextMenu.logical">
          <span v-html="Icons.Copy || '📋'"></span> Copy JP name 
          <span class="context-preview">{{ sheetContextMenu.logical }}</span>
        </div>
        <div class="menu-divider" style="height: 1px; background: rgba(128,128,128,0.2); margin: 4px 0;"></div>
        <div class="menu-item" @click="openSheetInExcel">
          <span v-html="Icons.ExternalLink || '↗'"></span> Open Excel Here
        </div>`;

code = code.replace(oldTemplate, newTemplate);

fs.writeFileSync(path, code, 'utf8');
console.log('TranslationPane.vue patched');
