use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri::Emitter;
use std::net::TcpStream;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
    pub extension: String,
}

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub line_num: usize,
    pub line_text: String,
}

#[derive(Clone, Serialize)]
pub struct SearchBatch {
    pub results: Vec<SearchResult>,
    pub done: bool,
    pub total: usize,
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

#[tauri::command]
fn list_directory_files(path: String) -> Result<Vec<String>, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() || !root_path.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }
    
    let mut files = vec![];
    if let Ok(entries) = fs::read_dir(root_path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(name) = entry_path.file_name() {
                    files.push(name.to_string_lossy().to_string());
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


#[tauri::command]
fn search_in_files(app: tauri::AppHandle, path: String, query: String) -> Result<(), String> {
    use ignore::WalkBuilder;
    use std::thread;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    let query_lower = query.to_lowercase();
    let root_path = std::path::PathBuf::from(&path);

    if !root_path.exists() || !root_path.is_dir() {
        return Err("Invalid search directory".to_string());
    }

    thread::spawn(move || {
        let walker = WalkBuilder::new(&root_path)
            .hidden(false) // Don't skip hidden files
            .ignore(false) // Don't skip ignored files for global search
            .git_ignore(false)
            .threads(std::cmp::min(8, num_cpus::get()))
            .build_parallel();

        let total_count = Arc::new(AtomicUsize::new(0));
        const MAX_RESULTS: usize = 1000;
        const BATCH_SIZE: usize = 40;

        struct SearchWorker {
            app: tauri::AppHandle,
            batch: Vec<SearchResult>,
            total_count: Arc<AtomicUsize>,
            query_lower: String,
        }

        impl Drop for SearchWorker {
            fn drop(&mut self) {
                if !self.batch.is_empty() {
                    let _ = self.app.emit("search:batch", SearchBatch {
                        results: self.batch.drain(..).collect(),
                        done: false,
                        total: self.total_count.load(Ordering::SeqCst),
                    });
                }
            }
        }

        walker.run(|| {
            let mut worker = SearchWorker {
                app: app.clone(),
                batch: Vec::new(),
                total_count: Arc::clone(&total_count),
                query_lower: query_lower.clone(),
            };

            Box::new(move |entry| {
                use ignore::WalkState;
                if worker.total_count.load(Ordering::Relaxed) >= MAX_RESULTS {
                    return WalkState::Quit;
                }

                let entry = match entry {
                    Ok(e) => e,
                    Err(_) => return WalkState::Continue,
                };

                if !entry.file_type().map_or(false, |ft| ft.is_file()) {
                    return WalkState::Continue;
                }

                let file_path = entry.path();
                if let Ok(bytes) = fs::read(file_path) {
                    let check_len = std::cmp::min(1024, bytes.len());
                    if bytes[..check_len].contains(&0) { return WalkState::Continue; }

                    let content = {
                        let (res, _, has_errors) = encoding_rs::UTF_8.decode(&bytes);
                        if !has_errors { res.into_owned() }
                        else {
                            let (res, _, _) = encoding_rs::SHIFT_JIS.decode(&bytes);
                            res.into_owned()
                        }
                    };

                    let path_str = file_path.to_string_lossy().to_string();
                    for (i, line) in content.lines().enumerate() {
                        if line.to_lowercase().contains(&worker.query_lower) {
                            worker.batch.push(SearchResult {
                                file_path: path_str.clone(),
                                line_num: i + 1,
                                line_text: line.trim().to_string(),
                            });

                            let current_total = worker.total_count.fetch_add(1, Ordering::SeqCst);
                            if worker.batch.len() >= BATCH_SIZE {
                                let _ = worker.app.emit("search:batch", SearchBatch {
                                    results: worker.batch.drain(..).collect(),
                                    done: false,
                                    total: current_total + 1,
                                });
                            }

                            if current_total >= MAX_RESULTS {
                                return WalkState::Quit;
                            }
                        }
                    }
                }

                WalkState::Continue
            })
        });

        // Final signal
        let _ = app.emit("search:batch", SearchBatch {
            results: Vec::new(),
            done: true,
            total: total_count.load(Ordering::SeqCst),
        });
    });

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
            open_file_path,
            read_dir_tree,
            git_execute,
            test_tcp_connection,
            search_in_files,
            list_directory_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}