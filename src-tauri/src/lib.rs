use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::Manager;
mod db;
mod system_control;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
    pub extension: String,
}



#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().config_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("vinx_universal")
        .join("settings.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: String) -> Result<(), String> {
    let path = app.path().config_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("vinx_universal");
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    fs::write(path.join("settings.json"), settings).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings_file(app: tauri::AppHandle) -> Result<(), String> {
    let path = app.path().config_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("vinx_universal")
        .join("settings.json");
    if path.exists() {
        opener::reveal(&path).map_err(|e: opener::OpenError| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    
    // Support BOM detection for UTF-8, UTF-16BE/LE
    if bytes.len() >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf {
        return Ok(String::from_utf8_lossy(&bytes[3..]).to_string());
    }
    if bytes.len() >= 2 {
        if bytes[0] == 0xff && bytes[1] == 0xfe {
             let (res, _, _) = encoding_rs::UTF_16LE.decode(&bytes[2..]);
             return Ok(res.into_owned());
        }
        if bytes[0] == 0xfe && bytes[1] == 0xff {
             let (res, _, _) = encoding_rs::UTF_16BE.decode(&bytes[2..]);
             return Ok(res.into_owned());
        }
    }

    // No BOM, try UTF-8
    let (res, _encoding, has_errors) = encoding_rs::UTF_8.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }

    // Try Shift-JIS (Common for Japanese logs)
    let (res, _encoding, has_errors) = encoding_rs::SHIFT_JIS.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }

    // Fallback to lossy UTF-8
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_path(path: String) -> Result<(), String> {
    opener::reveal(Path::new(&path)).map_err(|e: opener::OpenError| e.to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    opener::open(Path::new(&path)).map_err(|e: opener::OpenError| e.to_string())
}

#[tauri::command]
fn check_path_exists(path: String) -> bool {
    Path::new(&path).exists()
}


#[tauri::command]
fn read_dir_tree(path: String, depth: u32) -> Result<FileNode, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() {
        return Err("Path does not exist".to_string());
    }
    build_node(root_path, 0, depth)
}

#[tauri::command]
fn list_files_in_dir(path: String, extension: String) -> Result<Vec<String>, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() || !root_path.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }
    
    let mut files = vec![];
    if let Ok(entries) = fs::read_dir(root_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension() {
                    if ext.to_string_lossy().to_lowercase() == extension.to_lowercase() {
                        if let Some(full_path) = entry_path.to_str() {
                            files.push(full_path.to_string());
                        }
                    }
                }
            }
        }
    }
    
    files.sort();
    Ok(files)
}

fn build_node(path: &Path, depth: u32, max_depth: u32) -> Result<FileNode, String> {
    let name = path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());
    let path_str = path.to_string_lossy().to_string();
    let is_dir = path.is_dir();
    let extension = path.extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut children = vec![];

    if is_dir && depth < max_depth {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                let entry_name = entry_path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                // Filter out hidden folders and build artifacts
                if entry_name.starts_with('.') || entry_name == "node_modules" || entry_name == "target" || entry_name == "dist" {
                    continue;
                }
                
                if let Ok(child) = build_node(&entry_path, depth + 1, max_depth) {
                    children.push(child);
                }
            }
        }
    }

    children.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(FileNode { name, path: path_str, is_dir, children, extension })
}

#[tauri::command]
fn git_execute(args: Vec<String>, cwd: String) -> Result<String, String> {
    use std::process::Command;
    #[cfg(target_os = "windows")]
    let mut command = Command::new("git");
    
    #[cfg(not(target_os = "windows"))]
    let mut command = Command::new("git");

    let full_command = format!("git {}", args.join(" "));
    let output = command
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to execute '{}': {}", full_command, e))?;

    let decode_output = |bytes: &[u8]| -> String {
        // Try UTF-8 first
        let (res, _, has_errors) = encoding_rs::UTF_8.decode(bytes);
        if !has_errors {
            return res.into_owned();
        }
        // Fall back to Shift-JIS for Japanese Windows environments
        let (res, _, has_errors) = encoding_rs::SHIFT_JIS.decode(bytes);
        if !has_errors {
            return res.into_owned();
        }
        // Last resort: lossy UTF-8
        String::from_utf8_lossy(bytes).to_string()
    };

    if output.status.success() {
        Ok(decode_output(&output.stdout).trim_end().to_string())
    } else {
        Err(decode_output(&output.stderr).trim_end().to_string())
    }
}

#[tauri::command]
fn test_tcp_connection(host: String, port: u16) -> Result<String, String> {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;
    let addr = format!("{}:{}", host, port);
    match addr.to_socket_addrs() {
        Err(e) => return Err(format!("DNS error: {}", e)),
        Ok(mut addrs) => match addrs.next() {
            None => return Err("Could not resolve host".to_string()),
            Some(socket_addr) => {
                match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(5)) {
                    Ok(_) => Ok(format!("Connected to {}:{} successfully!", host, port)),
                    Err(e) => Err(format!("Connection failed: {}", e)),
                }
            }
        }
    }
}




#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            db::init_db(app.handle())?;
            Ok(())
        })
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
            open_file_path,
            open_path,
            read_dir_tree,
            git_execute,
            test_tcp_connection,
            list_files_in_dir,
            check_path_exists,
            system_control::get_system_control,
            system_control::list_system_controls,
            system_control::set_system_control
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}