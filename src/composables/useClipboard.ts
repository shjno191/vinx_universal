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
      await writeText(text);
      return true;
    } catch (error) {
      console.error('[Clipboard] Failed to copy:', error);
      return false;
    }
  };

  /**
   * Reads text from the system clipboard.
   * @returns string or empty
   */
  const readFromClipboard = async (): Promise<string> => {
    try {
      const text = await readText();
      return text || '';
    } catch (error) {
      console.error('[Clipboard] Failed to read:', error);
      return '';
    }
  };

  return {
    copyToClipboard,
    readFromClipboard,
  };
}
