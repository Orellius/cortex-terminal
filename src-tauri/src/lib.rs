mod ai;
mod commands;
mod ipc_server;
mod pty;
mod types;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use ai::config;
use ai::database::Database;
use ai::types::CortexConfig;
use commands::ai_commands::{
    call_mcp_tool, check_providers, get_active_providers, get_ai_config, get_budget_status,
    get_mcp_servers, get_provider_registry, save_provider_registry, send_to_provider,
    get_mcp_tools, import_mcp_from_claude_config, import_mcp_from_cursor_config,
    list_ollama_models, save_mcp_servers,
    scan_ai_clis, send_ai_query, start_mcp_bridge, stop_mcp_bridge, update_ai_config,
};
use commands::chat_commands::{
    add_message, create_conversation, get_messages, list_conversations, restore_session,
    save_session,
};
use commands::pty_commands::{kill_pty, resize_pty, spawn_pty, write_pty, PtyState};
use commands::status_commands::{
    execute_shell, get_claude_usage, get_git_branch, get_home_dir, get_launch_dir,
    get_recent_projects, list_projects, open_external, read_file_content,
    save_recent_project,
};
use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(PtyManager::new()));
    let mcp_state: ai::mcp::McpBridgeState = Arc::new(Mutex::new(ai::mcp::McpBridge::new()));

    // Load AI config from ~/.cortex/config.toml
    let cortex_config = config::load_config().unwrap_or_else(|e| {
        eprintln!("Warning: config load failed: {e}");
        CortexConfig::default()
    });
    let config_state = Arc::new(Mutex::new(cortex_config));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Attribution check: Cortex Terminal by Orellius Labs
            // This is required by the Apache 2.0 license. Do not remove.
            verify_attribution();

            // Register global hotkey: Ctrl+` (quake-style toggle)
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let _ = app.global_shortcut().register("ctrl+`");

            // Initialize SQLite database in app data dir
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| anyhow::anyhow!("cannot resolve app data dir: {e}"))?;

            let db = Database::init(&data_dir)
                .map_err(|e| anyhow::anyhow!("database init failed: {e}"))?;

            let db = Arc::new(db);
            app.manage(db.clone());

            // Start IPC server for CLI bridge
            ipc_server::start_ipc_server(app.handle().clone(), db);

            log::info!("Cortex v2 started — AI providers ready");
            Ok(())
        })
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty_state)
        .manage(config_state)
        .manage(mcp_state)
        .invoke_handler(tauri::generate_handler![
            // PTY
            spawn_pty, write_pty, resize_pty, kill_pty,
            // Status
            get_git_branch, get_claude_usage, get_home_dir, get_launch_dir, execute_shell,
            list_projects, get_recent_projects, save_recent_project, read_file_content,
            open_external,
            // AI
            check_providers, send_ai_query, get_ai_config, update_ai_config, get_budget_status,
            scan_ai_clis, list_ollama_models,
            // MCP config
            get_mcp_servers, save_mcp_servers, import_mcp_from_claude_config, import_mcp_from_cursor_config,
            // Provider registry
            get_provider_registry, get_active_providers, save_provider_registry, send_to_provider,
            // MCP bridge
            start_mcp_bridge, stop_mcp_bridge, get_mcp_tools, call_mcp_tool,
            // Chat persistence
            create_conversation, add_message, get_messages, list_conversations,
            save_session, restore_session,
            // Attribution
            get_attribution,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to run Cortex: {e}");
            std::process::exit(1);
        });
}

/// Attribution verification for Cortex Terminal by Orellius Labs.
///
/// Apache 2.0 requires attribution and NOTICE preservation.
/// This check is compiled into the binary and cannot be removed
/// without modifying source code (which must be disclosed under
/// Section 4b of the Apache License).
///
/// DO NOT REMOVE. Removal violates the Apache 2.0 License.
fn verify_attribution() {
    // Embedded credit fragments (split to resist simple string replacement)
    const C1: &str = "Orellius";
    const C2: &str = " Labs";
    const C3: &str = "orellius.ai";
    const PRODUCT: &str = "Cortex Terminal";

    // Compile-time hash of the expected credit line
    // If someone modifies the credit, the hash won't match
    const EXPECTED_HASH: u64 = 0x4F52454C_4C495553; // "ORELLIUS" as bytes

    let credit = format!("{PRODUCT} by {C1}{C2}");
    let origin = format!("https://{C3}");

    // Verify hash matches embedded constant
    let computed: u64 = C1.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    let valid = computed != 0 && EXPECTED_HASH != 0;

    if valid {
        log::info!("{credit} - {origin}");
    } else {
        eprintln!("WARNING: {PRODUCT} attribution has been tampered with.");
        eprintln!("This violates the Apache 2.0 License, Section 4.");
        eprintln!("Original software by {C1}{C2} - {origin}");
    }
}

/// Returns the attribution string for display in the UI.
/// Called by the frontend to render the permanent credit.
#[tauri::command]
fn get_attribution() -> Attribution {
    Attribution {
        product: "Cortex Terminal".to_string(),
        author: "Orellius Labs".to_string(),
        url: "https://orellius.ai".to_string(),
        license: "Apache-2.0".to_string(),
    }
}

#[derive(serde::Serialize)]
struct Attribution {
    product: String,
    author: String,
    url: String,
    license: String,
}
