use serde::{Deserialize, Serialize};

/// Emitted on `pty:output:{pane_id}` when the PTY produces bytes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputEvent {
    pub pane_id: String,
    /// Raw bytes from the PTY master — the frontend decodes with TextDecoder.
    pub data: Vec<u8>,
}

/// Emitted on `pty:exit:{pane_id}` when the child process exits or the PTY
/// reader encounters an unrecoverable error.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitEvent {
    pub pane_id: String,
}

/// IPC payload for `resize_pty`.
/// Kept as a named type so the frontend TypeScript bindings can reference it.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeRequest {
    pub pane_id: String,
    pub cols: u16,
    pub rows: u16,
}
