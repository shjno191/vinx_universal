import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Composable for standardized clipboard operations.
 */
export function useClipboard() {
  
  /**
   * Copies text to the system clipboard.
   * @param text string to copy
   * @returns boolean success
   */
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      // Try Tauri plugin first
      await writeText(text);
      return true;
    } catch (error) {
      // Fallback to Web API
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        throw new Error('Web Clipboard API not available');
      } catch (webError) {
        console.error('[Clipboard] Both Tauri and Web clipboard failed:', webError);
        return false;
      }
    }
  };

  const readFromClipboard = async (): Promise<string> => {
    try {
      // Try Tauri plugin first
      return await readText();
    } catch (error) {
      // Fallback to Web API
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          return await navigator.clipboard.readText();
        }
        return '';
      } catch (webError) {
        console.error('[Clipboard] Both Tauri and Web clipboard failed:', webError);
        return '';
      }
    }
  };

  return {
    copyToClipboard,
    readFromClipboard,
  };
}
