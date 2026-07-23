const fs = require('fs');

const path = 'd:\\\\vinx_tools\\\\vinx_universal\\\\packages\\\\core\\\\src-tauri\\\\src\\\\lib.rs';
let code = fs.readFileSync(path, 'utf8');

// Insert open_excel_at_sheet before run()
const commandCode = `

#[tauri::command]
fn open_excel_at_sheet(path: String, sheet_name: String) -> Result<(), String> {
    use std::process::Command;
    
    // Normalize path for Windows
    let normalized_path = path.replace("/", "\\\\");
    
    // Create a temporary PowerShell script to use COM automation
    let ps_script = format!(r#"
        $ErrorActionPreference = "Stop"
        try {{
            $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
            $excelWasRunning = $true
        }} catch {{
            $excel = New-Object -ComObject Excel.Application
            $excelWasRunning = $false
        }}
        
        $excel.Visible = $true
        $workbook = $null
        
        # Check if the file is already open
        foreach ($wb in $excel.Workbooks) {{
            if ($wb.FullName -eq "{}") {{
                $workbook = $wb
                break
            }}
        }}
        
        # If not open, open it
        if ($null -eq $workbook) {{
            $workbook = $excel.Workbooks.Open("{}")
        }}
        
        # Activate the specific sheet
        try {{
            $sheet = $workbook.Sheets.Item("{}")
            $sheet.Activate()
            # Bring Excel to front (using shell application)
            $wshell = New-Object -ComObject Wscript.Shell
            $wshell.AppActivate($excel.Caption)
        }} catch {{
            Write-Error "Sheet not found"
        }}
    "#, normalized_path, normalized_path, sheet_name);
    
    let mut command = Command::new("powershell");
    command.arg("-NoProfile")
           .arg("-Command")
           .arg(&ps_script);
           
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    match command.output() {
        Ok(output) => {
            if output.status.success() {
                Ok(())
            } else {
                let err = String::from_utf8_lossy(&output.stderr);
                Err(format!("PowerShell error: {}", err))
            }
        },
        Err(e) => Err(format!("Failed to execute PowerShell: {}", e)),
    }
}

`;

if (!code.includes('fn open_excel_at_sheet')) {
    code = code.replace('#[cfg_attr(mobile, tauri::mobile_entry_point)]', commandCode + '#[cfg_attr(mobile, tauri::mobile_entry_point)]');
}

if (!code.includes('open_excel_at_sheet,')) {
    code = code.replace('save_file_content,', 'save_file_content,\n            open_excel_at_sheet,');
}

fs.writeFileSync(path, code, 'utf8');
console.log('lib.rs patched for open_excel_at_sheet');
