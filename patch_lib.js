const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\core\\\\src-tauri\\\\src\\\\lib.rs';
let code = fs.readFileSync(path, 'utf8');

const newFn = `#[tauri::command]
fn open_excel_at_sheet(path: String, sheet_name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        
        let ps_script = format!(
            "$excel = New-Object -ComObject Excel.Application; $excel.Visible = $true; $workbook = $excel.Workbooks.Open('{}'); $worksheet = $workbook.Sheets.Item('{}'); $worksheet.Activate();",
            path.replace("'", "''"),
            sheet_name.replace("'", "''")
        );
        
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
            
        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Err("This feature is only supported on Windows".to_string())
    }
}

#[tauri::command]
fn check_path_exists(path: String) -> bool {`;

code = code.replace(`#[tauri::command]
fn check_path_exists(path: String) -> bool {`, newFn);

const newInvoke = `            open_path,
            open_excel_at_sheet,
            read_dir_tree,`;

code = code.replace(`            open_path,
            read_dir_tree,`, newInvoke);

fs.writeFileSync(path, code, 'utf8');
console.log('lib.rs patched for open_excel_at_sheet');
