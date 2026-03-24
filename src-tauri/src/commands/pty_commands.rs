use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

use tauri::{AppHandle, State};

use crate::pty::PtyManager;

/// Shared application state — a single PtyManager protected by a std Mutex.
///
/// `std::sync::Mutex` is correct here: no `.await` point is ever held while
/// the lock is taken, so there is no risk of blocking the async runtime.
pub(crate) type PtyState = Arc<Mutex<PtyManager>>;

// ---------------------------------------------------------------------------
// Helper — map anyhow::Error to String for IPC transport
// ---------------------------------------------------------------------------

fn to_ipc_err(e: anyhow::Error) -> String {
    // Include the full error chain so the frontend can surface diagnostics.
    format!("{e:#}")
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Spawns a new PTY session identified by `pane_id`.
///
/// `cwd` must be an absolute path to an existing directory. If a session with
/// the same `pane_id` already exists this command returns an error — callers
/// must `kill_pty` the existing session first.
#[tauri::command]
pub(crate) async fn spawn_pty(
    pane_id: String,
    cwd: String,
    state: State<'_, PtyState>,
    app: AppHandle,
) -> Result<(), String> {
    let cwd_path = PathBuf::from(&cwd);

    if !cwd_path.is_dir() {
        return Err(format!("cwd '{cwd}' is not an existing directory"));
    }

    let mut manager = state
        .lock()
        .map_err(|_| "PtyManager mutex poisoned".to_string())?;

    manager.spawn(pane_id, cwd_path, app).map_err(to_ipc_err)
}

/// Writes raw bytes to the PTY stdin for the given pane.
#[tauri::command]
pub(crate) async fn write_pty(
    pane_id: String,
    data: Vec<u8>,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let manager = state
        .lock()
        .map_err(|_| "PtyManager mutex poisoned".to_string())?;

    manager.write(&pane_id, &data).map_err(to_ipc_err)
}

/// Resizes the PTY for the given pane to `cols` × `rows` cells.
#[tauri::command]
pub(crate) async fn resize_pty(
    pane_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let manager = state
        .lock()
        .map_err(|_| "PtyManager mutex poisoned".to_string())?;

    manager.resize(&pane_id, cols, rows).map_err(to_ipc_err)
}

/// Kills the child process and removes the session for the given pane.
#[tauri::command]
pub(crate) async fn kill_pty(pane_id: String, state: State<'_, PtyState>) -> Result<(), String> {
    let mut manager = state
        .lock()
        .map_err(|_| "PtyManager mutex poisoned".to_string())?;

    manager.kill(&pane_id).map_err(to_ipc_err)
}
