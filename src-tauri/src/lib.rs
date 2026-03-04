use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Settings {
    pub theme: String,
    pub dictionary_path: String,
    pub shortcuts: HashMap<String, String>,
}

impl Default for Settings {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("focus_search".to_string(), "ctrl+f".to_string());
        shortcuts.insert("open_settings".to_string(), "ctrl+shift+s".to_string());
        shortcuts.insert("open_file".to_string(), "ctrl+o".to_string());
        
        Self {
            theme: "dark".to_string(),
            dictionary_path: "".to_string(),
            shortcuts,
        }
    }
}

fn get_settings_path() -> PathBuf {
    let mut path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    path.pop(); // Remove the executable name
    path.push("settings.json");
    path
}

#[tauri::command]
fn get_settings(app_handle: tauri::AppHandle) -> Settings {
    let path = get_settings_path();
    if !path.exists() {
        let default_settings = Settings::default();
        let _ = save_settings(app_handle, default_settings.clone());
        return default_settings;
    }

    let content = fs::read_to_string(path).unwrap_or_default();
    let mut settings: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
    
    // Merge logic: ensure all keys from default exist
    let default_val = serde_json::to_value(Settings::default()).unwrap();
    if let Some(obj) = settings.as_object_mut() {
        if let Some(def_obj) = default_val.as_object() {
            for (k, v) in def_obj {
                if !obj.contains_key(k) {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }
    } else {
        settings = default_val;
    }

    serde_json::from_value(settings).unwrap_or_default()
}

#[tauri::command]
fn save_settings(_app_handle: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_settings_file(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = get_settings_path();
    if !path.exists() {
        let _ = get_settings(app_handle.clone());
    }
    
    open_file_path(path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }
    
    let bytes = fs::read(p).map_err(|e| e.to_string())?;
    
    // Try UTF-8 first
    let (res, _encoding, has_errors) = encoding_rs::UTF_8.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }
    
    // Fallback to Shift-JIS (Common for Japanese logs)
    let (res, _encoding, has_errors) = encoding_rs::SHIFT_JIS.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }

    // Last resort: just decode as UTF-8 ignoring errors
    Ok(res.into_owned())
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }
    
    fs::read(p).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    fs::write(p, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let mut arg = std::ffi::OsString::from("/select,");
        arg.push(p);
        
        std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Fallback or other OS specific logic
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            open_settings_file,
            read_file_content,
            read_file_binary,
            write_file_binary,
            open_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
