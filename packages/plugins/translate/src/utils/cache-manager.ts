import { useFileSystem } from '@vinx/sdk';
import { invoke } from '@tauri-apps/api/core';

export interface SheetCacheData {
  names: string[];
  metadata: Record<string, any>;
  mappings: Record<string, Record<string, string>>;
}

let cachedConfigDir: string | null = null;

export function useCacheManager() {
  const { readFile, writeFile } = useFileSystem();

  const getConfigDir = async (): Promise<string> => {
    if (cachedConfigDir) return cachedConfigDir;
    try {
      cachedConfigDir = await invoke<string>('get_app_config_dir');
      return cachedConfigDir;
    } catch (error) {
      console.error('[CacheManager] Failed to get config dir:', error);
      return '';
    }
  };

  const getCachePath = async (excelPath: string): Promise<string> => {
    const configDir = await getConfigDir();
    if (!configDir) return excelPath.replace(/\.xlsx?$/, '.json');
    
    // Get the filename from the path
    const filename = excelPath.split(/[/\\]/).pop() || 'cache';
    const jsonName = filename.replace(/\.xlsx?$/, '.json');
    
    // Standardize path separator to forward slash for consistency in JS
    // but the backend handles native paths. configDir is already native.
    return `${configDir}/${jsonName}`.replace(/\\/g, '/');
  };

  const saveCache = async (excelPath: string, data: any) => {
    try {
      const cachePath = await getCachePath(excelPath);
      await writeFile(cachePath, JSON.stringify(data, null, 2));
      console.log(`[CacheManager] Saved cache to: ${cachePath}`);
    } catch (error) {
      console.warn(`[CacheManager] Failed to save cache for ${excelPath}:`, error);
    }
  };

  const loadCache = async (excelPath: string): Promise<any | null> => {
    try {
      const cachePath = await getCachePath(excelPath);
      const content = await readFile(cachePath);
      if (content) {
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  return {
    getCachePath,
    saveCache,
    loadCache
  };
}
