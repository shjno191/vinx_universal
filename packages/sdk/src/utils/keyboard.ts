/**
 * Checks if a keyboard event matches a given shortcut string (e.g., 'ctrl+shift+s').
 */
export const matchShortcut = (e: KeyboardEvent, shortcutStr: string) => {
  if (!shortcutStr) return false;
  const parts = shortcutStr.toLowerCase().split('+');
  const key = parts.pop();
  const ctrl = parts.includes('ctrl');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const meta = parts.includes('meta');
  let k = e.key ? e.key.toLowerCase() : '';
  if (k === '`' && key === '~') k = '~';
  if (k === '~' && key === '`') k = '`';
  if ((key === '[' || key === '{') && (k === '[' || k === '{' || e.code === 'BracketLeft')) {
    k = key;
  }
  if ((key === ']' || key === '}') && (k === ']' || k === '}' || e.code === 'BracketRight')) {
    k = key;
  }
  if ((key === 'arrowup' || key === 'up') && (k === 'arrowup' || k === 'up' || e.code === 'ArrowUp')) {
    k = key;
  }
  if ((key === 'arrowdown' || key === 'down') && (k === 'arrowdown' || k === 'down' || e.code === 'ArrowDown')) {
    k = key;
  }
  if ((key === 'arrowleft' || key === 'left') && (k === 'arrowleft' || k === 'left' || e.code === 'ArrowLeft')) {
    k = key;
  }
  if ((key === 'arrowright' || key === 'right') && (k === 'arrowright' || k === 'right' || e.code === 'ArrowRight')) {
    k = key;
  }
  
  return k === key &&
         e.ctrlKey === ctrl &&
         e.shiftKey === shift &&
         e.altKey === alt &&
         e.metaKey === meta;
};
