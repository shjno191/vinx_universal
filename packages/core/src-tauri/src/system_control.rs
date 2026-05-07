use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use once_cell::sync::Lazy;
use tauri::{command, AppHandle};
use crate::db::get_connection;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemControl {
    #[serde(rename = "controlKey")]
    pub control_key: String,
    pub section: String,
    #[serde(rename = "controlValue")]
    pub control_value: Option<String>,
    pub description: Option<String>,
}

// Memory Cache for System Control values
// Format: Key = "section:key", Value = CONTROL_VALUE
static SYSTEM_CONTROL_CACHE: Lazy<RwLock<HashMap<String, String>>> = Lazy::new(|| {
    RwLock::new(HashMap::new())
});

#[command]
pub fn get_system_control(
    app: AppHandle,
    control_key: String,
    section: Option<String>,
) -> Result<Option<String>, String> {
    let section = section.unwrap_or_else(|| "COMMON".to_string());
    let cache_key = format!("{}:{}", section, control_key);

    // 1. Check Cache
    {
        let cache = SYSTEM_CONTROL_CACHE.read().map_err(|e| e.to_string())?;
        if let Some(value) = cache.get(&cache_key) {
            return Ok(Some(value.clone()));
        }
    }

    // 2. Query DB
    let conn = get_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT CONTROL_VALUE FROM M_SYSTEM_CONTROL WHERE CONTROL_KEY = ?1 AND SECTION = ?2")
        .map_err(|e| e.to_string())?;

    let control_value: Option<String> = stmt
        .query_row([&control_key, &section], |row| row.get(0))
        .ok(); // We use .ok() here because RowNotFound is fine, we just return None

    // 3. Update Cache if found
    if let Some(ref value) = control_value {
        let mut cache = SYSTEM_CONTROL_CACHE.write().map_err(|e| e.to_string())?;
        cache.insert(cache_key, value.clone());
    }

    Ok(control_value)
}

#[command]
pub fn list_system_controls(app: AppHandle) -> Result<Vec<SystemControl>, String> {
    let conn = get_connection(&app)?;
    let mut stmt = conn
        .prepare("SELECT CONTROL_KEY, SECTION, CONTROL_VALUE, DESCRIPTION FROM M_SYSTEM_CONTROL")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SystemControl {
                control_key: row.get(0)?,
                section: row.get(1)?,
                control_value: row.get(2)?,
                description: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }

    Ok(result)
}

#[command]
pub fn set_system_control(
    app: AppHandle,
    control_key: String,
    control_value: String,
    section: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let section = section.unwrap_or_else(|| "COMMON".to_string());
    let cache_key = format!("{}:{}", section, control_key);

    let conn = get_connection(&app)?;
    conn.execute(
        "INSERT OR REPLACE INTO M_SYSTEM_CONTROL (CONTROL_KEY, SECTION, CONTROL_VALUE, DESCRIPTION)
         VALUES (?1, ?2, ?3, ?4)",
        [&control_key, &section, &control_value, &description.unwrap_or_default()],
    ).map_err(|e| e.to_string())?;

    // Update Cache
    let mut cache = SYSTEM_CONTROL_CACHE.write().map_err(|e| e.to_string())?;
    cache.insert(cache_key, control_value);

    Ok(())
}
