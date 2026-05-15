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
  
  return e.key.toLowerCase() === key &&
         e.ctrlKey === ctrl &&
         e.shiftKey === shift &&
         e.altKey === alt &&
         e.metaKey === meta;
};
