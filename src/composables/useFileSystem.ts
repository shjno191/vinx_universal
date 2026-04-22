import { invoke } from '@tauri-apps/api/core';

/**
 * Composable for centralized file system operations.
 * Resolves encoding issues and standardizes error handling.
 */
export function useFileSystem() {
  
  /**
   * Reads a text file using Tauri's bridge.
   * @param path Full system path to the file
   * @returns file content as string
   */
  const readFile = async (path: string): Promise<string> => {
    try {
      const content = await invoke<string>('read_file_content', { path });
      return content;
    } catch (error) {
      console.error(`[FileSystem] Error reading text file at ${path}:`, error);
      throw error;
    }
  };

  /**
   * Reads a binary file (e.g., Excel) as raw bytes.
   * @param path Full system path
   * @returns Uint8Array of file content
   */
  const readBinary = async (path: string): Promise<any> => {
    try {
      const b64 = await invoke<string>('read_file_binary', { path });
      return b64;
    } catch (error) {
      console.error(`[FileSystem] Error reading binary file at ${path}:`, error);
      throw error;
    }
  };

  /**
   * Writes content to a file.
   * @param path Full system path
   * @param content String content to save
   */
  const writeFile = async (path: string, content: string): Promise<void> => {
    try {
      await invoke('save_file_content', { path, content });
    } catch (error) {
      console.error(`[FileSystem] Error writing file at ${path}:`, error);
      throw error;
    }
  };

  return {
    readFile,
    readBinary,
    writeFile,
  };
}
