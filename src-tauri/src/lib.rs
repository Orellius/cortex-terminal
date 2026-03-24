mod commands;
mod pty;
mod types;

use std::sync::{Arc, Mutex};

use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty, PtyState};
use commands::status_commands::{get_claude_usage, get_git_branch, get_home_dir, list_projects};
use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(PtyManager::new()));

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(pty_state)
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, resize_pty, kill_pty,
            get_git_branch, get_claude_usage, get_home_dir, list_projects,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run Tauri application: {e}");
            std::process::exit(1);
        });
}
