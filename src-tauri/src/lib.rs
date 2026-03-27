mod ai;
mod commands;
mod pty;
mod types;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use ai::config;
use ai::database::Database;
use ai::types::CortexConfig;
use commands::ai_commands::{
    check_providers, get_ai_config, get_budget_status, list_ollama_models, scan_ai_clis,
    send_ai_query, update_ai_config,
};
use commands::chat_commands::{add_message, create_conversation, get_messages, list_conversations};
use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty, PtyState};
use commands::status_commands::{
    get_claude_usage, get_git_branch, get_home_dir, list_projects, open_external,
    read_file_content,
};
use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(PtyManager::new()));

    // Load AI config from ~/.cortex/config.toml
    let cortex_config = config::load_config().unwrap_or_else(|e| {
        eprintln!("Warning: config load failed: {e}");
        CortexConfig::default()
    });
    let config_state = Arc::new(Mutex::new(cortex_config));

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite database in app data dir
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| anyhow::anyhow!("cannot resolve app data dir: {e}"))?;

            let db = Database::init(&data_dir)
                .map_err(|e| anyhow::anyhow!("database init failed: {e}"))?;

            app.manage(Arc::new(db));

            log::info!("Cortex v2 started — AI providers ready");
            Ok(())
        })
        .manage(pty_state)
        .manage(config_state)
        .invoke_handler(tauri::generate_handler![
            // PTY
            spawn_pty, write_pty, resize_pty, kill_pty,
            // Status
            get_git_branch, get_claude_usage, get_home_dir, list_projects, read_file_content,
            open_external,
            // AI
            check_providers, send_ai_query, get_ai_config, update_ai_config, get_budget_status,
            scan_ai_clis, list_ollama_models,
            // Chat persistence
            create_conversation, add_message, get_messages, list_conversations,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run Cortex: {e}");
            std::process::exit(1);
        });
}
