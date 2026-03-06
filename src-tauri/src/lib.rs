use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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
    let (res, _encoding, has_errors) = encoding_rs::UTF_8.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }
    let (res, _encoding, has_errors) = encoding_rs::SHIFT_JIS.decode(&bytes);
    if !has_errors {
        return Ok(res.into_owned());
    }
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
fn read_dir_tree(path: String, depth: u32) -> Result<FileNode, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() {
        return Err("Path does not exist".to_string());
    }
    build_node(root_path, 0, depth)
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
    let mut command = Command::new("cmd");
    #[cfg(target_os = "windows")]
    command.args(&["/C", "git"]);
    
    #[cfg(not(target_os = "windows"))]
    let mut command = Command::new("git");

    let output = command
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;

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
            read_dir_tree,
            git_execute,
            test_tcp_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}