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
  let k = e.key.toLowerCase();
  if (k === '`' && key === '~') k = '~';
  if (k === '~' && key === '`') k = '`';
  if (k === 'arrowup' && key === 'up') k = 'up';
  if (k === 'arrowdown' && key === 'down') k = 'down';
  if (k === 'arrowleft' && key === 'left') k = 'left';
  if (k === 'arrowright' && key === 'right') k = 'right';
  if (k === 'up' && key === 'arrowup') k = 'arrowup';
  if (k === 'down' && key === 'arrowdown') k = 'arrowdown';
  if (k === 'left' && key === 'arrowleft') k = 'arrowleft';
  if (k === 'right' && key === 'arrowright') k = 'arrowright';
  
  return k === key &&
         e.ctrlKey === ctrl &&
         e.shiftKey === shift &&
         e.altKey === alt &&
         e.metaKey === meta;
};
