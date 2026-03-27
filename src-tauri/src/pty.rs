use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
};

use anyhow::{Context, Result};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};

use crate::types::{PtyExitEvent, PtyOutputEvent};

/// Read buffer size — 8 KB fits comfortably on the stack and covers typical
/// terminal burst output without triggering the allocator on every read.
const READ_BUF: usize = 8 * 1024;

// ---------------------------------------------------------------------------
// PtySession — one live terminal session
// ---------------------------------------------------------------------------

struct PtySession {
    /// Writer half of the master PTY. Wrapped in Mutex so concurrent Tauri
    /// command invocations can write without holding the full manager lock.
    writer: Mutex<Box<dyn Write + Send>>,
    /// The child process handle. Kept alive so we can signal it on kill().
    child: Box<dyn Child + Send + Sync>,
    /// The master PTY handle. Kept alive to hold the fd open. Dropped on kill
    /// which closes the fd and causes the reader thread to get EOF.
    _master: Box<dyn MasterPty + Send>,
    /// Signals the reader thread to stop on the next iteration.
    killed: Arc<AtomicBool>,
}

// ---------------------------------------------------------------------------
// PtyManager — session registry
// ---------------------------------------------------------------------------

pub(crate) struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub(crate) fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Spawns the user's default shell in `cwd`, starts a background reader
    /// thread that emits `pty:output:{pane_id}` events, and stores the session.
    ///
    /// Returns an error if a session with the same `pane_id` already exists,
    /// if the working directory does not exist, or if PTY allocation fails.
    pub(crate) fn spawn(
        &mut self,
        pane_id: String,
        cwd: PathBuf,
        app_handle: AppHandle,
    ) -> Result<()> {
        if self.sessions.contains_key(&pane_id) {
            anyhow::bail!("session '{}' already exists", pane_id);
        }

        let pty_system = native_pty_system();

        let master = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("failed to open PTY pair")?;

        let shell = default_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(cwd);
        // Provide a sane minimal environment.
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        // Suppress zsh PROMPT_EOL_MARK (the trailing % on incomplete lines)
        cmd.env("PROMPT_EOL_MARK", "");
        // Inherit PATH from the parent process so shell builtins resolve.
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", path);
        }
        if let Ok(home) = home_dir_string() {
            cmd.env("HOME", home);
        }
        if let Ok(user) = std::env::var("USER") {
            cmd.env("USER", user);
        }

        let child = master
            .slave
            .spawn_command(cmd)
            .with_context(|| format!("failed to spawn shell: {shell}"))?;

        // Obtain a reader *before* storing the session so we can move it into
        // the thread without holding the manager lock during I/O.
        let mut reader = master
            .master
            .try_clone_reader()
            .context("failed to clone PTY reader")?;

        let writer = master
            .master
            .take_writer()
            .context("failed to take PTY writer")?;

        let killed = Arc::new(AtomicBool::new(false));
        let killed_reader = Arc::clone(&killed);
        let reader_pane_id = pane_id.clone();

        // Spawn the reader thread. It owns `reader` exclusively — it never
        // re-acquires the manager mutex, which prevents any deadlock.
        thread::Builder::new()
            .name(format!("pty-reader-{pane_id}"))
            .spawn(move || {
                reader_loop(&mut *reader, reader_pane_id, app_handle, killed_reader);
            })
            .context("failed to spawn PTY reader thread")?;

        self.sessions.insert(
            pane_id,
            PtySession {
                writer: Mutex::new(writer),
                child,
                _master: master.master,
                killed,
            },
        );

        Ok(())
    }

    /// Writes `data` to the named session's PTY stdin.
    pub(crate) fn write(&self, pane_id: &str, data: &[u8]) -> Result<()> {
        let session = self
            .sessions
            .get(pane_id)
            .with_context(|| format!("no PTY session '{pane_id}'"))?;

        let mut writer = session
            .writer
            .lock()
            .map_err(|_| anyhow::anyhow!("writer mutex poisoned for '{pane_id}'"))?;

        writer
            .write_all(data)
            .with_context(|| format!("write to PTY '{pane_id}' failed"))?;

        writer
            .flush()
            .with_context(|| format!("flush PTY '{pane_id}' failed"))
    }

    /// Resizes the PTY for the named session.
    pub(crate) fn resize(&self, pane_id: &str, cols: u16, rows: u16) -> Result<()> {
        let session = self
            .sessions
            .get(pane_id)
            .with_context(|| format!("no PTY session '{pane_id}'"))?;

        // portable-pty exposes resize on the master handle. We stored it as
        // `_master` to keep the fd alive — re-acquire via the session's master.
        // Because `_master` is a Box<dyn MasterPty>, call resize on it.
        session
            ._master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .with_context(|| format!("resize PTY '{pane_id}' failed"))
    }

    /// Kills the child process and removes the session.
    ///
    /// Dropping the session closes the master PTY fd, which causes the reader
    /// thread to receive EOF and exit cleanly.
    pub(crate) fn kill(&mut self, pane_id: &str) -> Result<()> {
        let mut session = self
            .sessions
            .remove(pane_id)
            .with_context(|| format!("no PTY session '{pane_id}'"))?;

        // Signal the reader thread to stop, then let Drop close the fd.
        session.killed.store(true, Ordering::Relaxed);

        session
            .child
            .kill()
            .with_context(|| format!("kill child for '{pane_id}' failed"))
    }
}

// ---------------------------------------------------------------------------
// Reader loop — runs on its own OS thread, never holds any mutex
// ---------------------------------------------------------------------------

fn reader_loop(
    reader: &mut dyn Read,
    pane_id: String,
    app_handle: AppHandle,
    killed: Arc<AtomicBool>,
) {
    let mut buf = [0u8; READ_BUF];

    loop {
        if killed.load(Ordering::Relaxed) {
            break;
        }

        let n = match reader.read(&mut buf) {
            Ok(0) => {
                // EOF — child exited or master fd closed.
                break;
            }
            Ok(n) => n,
            Err(e) => {
                // A real read error. Log it (best-effort) and break so we
                // emit the exit event below.
                eprintln!("[pty-reader-{pane_id}] read error: {e}");
                break;
            }
        };

        let payload = PtyOutputEvent {
            pane_id: pane_id.clone(),
            data: buf[..n].to_vec(),
        };

        // Discard emit errors — the window may have closed.
        let _ = app_handle.emit(&format!("pty:output:{pane_id}"), payload);
    }

    // Always emit the exit event so the frontend can clean up its xterm pane.
    let _ = app_handle.emit(
        &format!("pty:exit:{pane_id}"),
        PtyExitEvent {
            pane_id: pane_id.clone(),
        },
    );
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/// Returns the user's default shell binary.
/// Unix: reads $SHELL, falls back to /bin/sh.
/// Windows: reads %COMSPEC%, falls back to cmd.exe.
fn default_shell() -> String {
    #[cfg(unix)]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
}

/// Returns the user's home directory as a String.
/// Unix: $HOME. Windows: $USERPROFILE.
fn home_dir_string() -> std::result::Result<String, std::env::VarError> {
    #[cfg(unix)]
    {
        std::env::var("HOME")
    }
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
    }
}
