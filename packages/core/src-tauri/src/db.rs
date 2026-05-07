use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().config_dir()
        .map_err(|e| e.to_string())?
        .join("vinx_universal");
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    
    Ok(path.join("app.db"))
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let db_path = get_db_path(app)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS M_SYSTEM_CONTROL (
            CONTROL_KEY TEXT NOT NULL,
            SECTION TEXT NOT NULL DEFAULT 'COMMON',
            CONTROL_VALUE TEXT,
            DESCRIPTION TEXT,
            PRIMARY KEY (CONTROL_KEY, SECTION)
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_connection(app: &AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app)?;
    Connection::open(db_path).map_err(|e| e.to_string())
}
