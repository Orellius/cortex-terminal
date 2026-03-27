//! Local Unix socket IPC server for the `cortex` CLI bridge.
//! Listens on ~/.cortex/cortex.sock for commands from the CLI.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;

use crate::ai::database::Database;

/// Start the IPC server on a background task.
/// Listens for single-line JSON commands on ~/.cortex/cortex.sock.
pub fn start_ipc_server(app: AppHandle, db: Arc<Database>) {
    tokio::spawn(async move {
        if let Err(e) = run_server(app, db).await {
            log::error!("IPC server error: {e}");
        }
    });
}

fn socket_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cortex").join("cortex.sock")
}

async fn run_server(app: AppHandle, _db: Arc<Database>) -> Result<()> {
    let path = socket_path();

    // Remove stale socket
    let _ = std::fs::remove_file(&path);

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context("mkdir .cortex")?;
    }

    let listener = UnixListener::bind(&path).context("bind socket")?;
    log::info!("IPC server listening on {}", path.display());

    loop {
        let (stream, _) = listener.accept().await.context("accept")?;
        let app = app.clone();

        tokio::spawn(async move {
            let (reader, mut writer) = stream.into_split();
            let mut lines = BufReader::new(reader).lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let response = handle_command(&line, &app).await;
                let _ = writer.write_all(response.as_bytes()).await;
                let _ = writer.write_all(b"\n").await;
            }
        });
    }
}

async fn handle_command(line: &str, app: &AppHandle) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => return format!(r#"{{"error":"parse error: {e}"}}"#),
    };

    let cmd = parsed["cmd"].as_str().unwrap_or("");

    match cmd {
        "ask" => {
            let query = parsed["query"].as_str().unwrap_or("");
            if query.is_empty() {
                return r#"{"error":"empty query"}"#.to_string();
            }
            // Emit event to frontend to process the query
            let _ = app.emit("cortex:cli:ask", serde_json::json!({ "query": query }));
            r#"{"status":"sent"}"#.to_string()
        }
        "preview" => {
            let path = parsed["path"].as_str().unwrap_or("");
            if path.is_empty() {
                return r#"{"error":"empty path"}"#.to_string();
            }
            let _ = app.emit("cortex:cli:preview", serde_json::json!({ "path": path }));
            r#"{"status":"sent"}"#.to_string()
        }
        "status" => {
            r#"{"status":"running","version":"2.0.0"}"#.to_string()
        }
        "focus" => {
            if let Some(window) = app.get_webview_window("main") {
                let win: &WebviewWindow = &window;
                let _ = win.show();
                let _ = win.set_focus();
            }
            r#"{"status":"focused"}"#.to_string()
        }
        _ => {
            format!(r#"{{"error":"unknown command: {cmd}"}}"#)
        }
    }
}
