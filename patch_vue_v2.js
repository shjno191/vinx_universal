const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\plugins\\\\translate\\\\src\\\\translate\\\\TranslationPane.vue';
let code = fs.readFileSync(path, 'utf8');

const oldOpenSheet = `const openSheetInExcel = async () => {
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

const newOpenSheet = `const openSheetInExcel = async () => {
  if (sheetContextMenu.value?.fullKey) {
    const file = sheetContextMenu.value.fullKey.split('::').slice(0, -1).join('::');
    const sheetName = sheetContextMenu.value.fullKey.split('::').pop();
    try {
      // Call the rust command silently to avoid overwriting the user's clipboard
      await invoke('open_excel_at_sheet', { path: file, sheetName });
    } catch (e) {
      console.error(e);
    }
  }
  closeContextMenu();
};`;

code = code.replace(oldOpenSheet, newOpenSheet);
fs.writeFileSync(path, code, 'utf8');
console.log('TranslationPane.vue patched for open Excel clipboard bug');
