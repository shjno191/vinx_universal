import { invoke } from "@tauri-apps/api/core";

export interface SystemControl {
  key: string;
  section: string;
  value: string | null;
  description: string | null;
}

/**
 * Get system control value with caching (handled by backend)
 * @param key Identification key for the control
 * @param section Optional section name (defaults to 'COMMON')
 * @returns The control value or null if not found
 */
export async function getSystemControl(key: string, section?: string): Promise<string | null> {
  try {
    return await invoke<string | null>("get_system_control", { controlKey: key, section });
  } catch (err) {
    console.error("Failed to get system control:", err);
    return null;
  }
}

/**
 * List all system controls
 * @returns An array of system controls
 */
export async function listSystemControls(): Promise<SystemControl[]> {
  try {
    return await invoke<SystemControl[]>("list_system_controls");
  } catch (err) {
    console.error("Failed to list system controls:", err);
    return [];
  }
}

/**
 * Set system control value (updates both DB and memory cache)
 * @param key Identification key for the control
 * @param value The value to set
 * @param section Optional section name (defaults to 'COMMON')
 * @param description Optional description for the control
 */
export async function setSystemControl(
  key: string,
  value: string,
  section?: string,
  description?: string
): Promise<void> {
  try {
    await invoke("set_system_control", {
      controlKey: key,
      controlValue: value,
      section,
      description,
    });
  } catch (err) {
    console.error("Failed to set system control:", err);
    throw err;
  }
}
