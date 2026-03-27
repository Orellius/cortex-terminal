use serde::Serialize;
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use std::fs;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ClaudeUsage {
    pub session_pct: f64,
    pub weekly_pct: f64,
    pub session_resets: String,
    pub weekly_resets: String,
}

impl Default for ClaudeUsage {
    fn default() -> Self {
        Self {
            session_pct: 0.0,
            weekly_pct: 0.0,
            session_resets: "\u{2014}".to_owned(),
            weekly_resets: "\u{2014}".to_owned(),
        }
    }
}

/// Runs `git rev-parse --abbrev-ref HEAD` in `cwd`.
/// Returns the branch name, or "—" if the directory is not a git repo or any
/// step fails.
#[tauri::command]
pub(crate) fn get_git_branch(cwd: String) -> Result<String, String> {
    let path = Path::new(&cwd);

    // Guard: directory must exist. An absent path is not a git repo.
    if !path.is_dir() {
        return Ok("\u{2014}".to_owned());
    }

    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path)
        // Discard stdin so git cannot block waiting for input.
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok("\u{2014}".to_owned());
    }

    let branch = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_owned();

    if branch.is_empty() {
        return Ok("\u{2014}".to_owned());
    }

    Ok(branch)
}

/// Execute a shell command and return stdout + stderr.
/// Used for `!` prefix commands in the AI chat.
#[tauri::command]
pub(crate) async fn execute_shell(
    command: String,
    cwd: Option<String>,
) -> Result<ShellResult, String> {
    let work_dir = cwd
        .or_else(|| std::env::current_dir().ok().map(|p| p.to_string_lossy().to_string()))
        .unwrap_or_else(|| "/tmp".to_string());

    tokio::task::spawn_blocking(move || {
        let output = Command::new("/bin/zsh")
            .args(["-c", &command])
            .current_dir(&work_dir)
            .output()
            .map_err(|e| format!("shell error: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(ShellResult {
            stdout,
            stderr,
            exit_code: output.status.code().unwrap_or(-1),
        })
    })
    .await
    .map_err(|e| format!("task failed: {e}"))?
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ShellResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Returns the user's home directory path.
#[tauri::command]
pub(crate) async fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME").map_err(|e| format!("HOME not set: {e}"))
}

/// Returns the directory Cortex was launched from (process cwd).
#[tauri::command]
pub(crate) async fn get_launch_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("cwd error: {e}"))
}

// ---------------------------------------------------------------------------
// Internal helpers for get_claude_usage
// ---------------------------------------------------------------------------

/// Reads the Claude Code credential JSON from the macOS Keychain via the
/// `security` CLI. Returns `None` on any failure so callers can degrade
/// gracefully.
fn read_keychain_token() -> Option<String> {
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            "Claude Code-credentials",
            "-w",
        ])
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8(output.stdout).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    // The credential is a JSON blob. Extract claudeAiOauth.accessToken.
    let json: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let token = json
        .get("claudeAiOauth")?
        .get("accessToken")?
        .as_str()?
        .to_owned();

    if token.is_empty() {
        return None;
    }

    Some(token)
}

/// Fetches usage data from the Anthropic OAuth usage endpoint and maps it
/// to a `ClaudeUsage`. Returns `None` on any transport or parse failure.
fn fetch_usage(token: &str) -> Option<ClaudeUsage> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .ok()?;

    let response = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Authorization", format!("Bearer {token}"))
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("User-Agent", "cortex/0.1.0")
        .send()
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let body: serde_json::Value = response.json().ok()?;

    // API returns utilization as a percentage (e.g., 7.0 = 7%), not a decimal
    let session_pct = body
        .get("five_hour")
        .and_then(|v| v.get("utilization"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let weekly_pct = body
        .get("seven_day")
        .and_then(|v| v.get("utilization"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let session_resets = body
        .get("five_hour")
        .and_then(|v| v.get("resets_at"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| "\u{2014}".to_owned());

    let weekly_resets = body
        .get("seven_day")
        .and_then(|v| v.get("resets_at"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| "\u{2014}".to_owned());

    Some(ClaudeUsage {
        session_pct,
        weekly_pct,
        session_resets,
        weekly_resets,
    })
}

/// Reads the Claude OAuth token from the macOS Keychain and fetches usage
/// from the Anthropic API. Always returns a `ClaudeUsage` — zeros and "—"
/// on any failure so the status bar always renders something.
#[tauri::command]
pub(crate) fn get_claude_usage() -> Result<ClaudeUsage, String> {
    let token = match read_keychain_token() {
        Some(t) => t,
        None => return Err("no keychain token".to_string()),
    };

    fetch_usage(&token).ok_or_else(|| "usage fetch failed (rate limited or network error)".to_string())
}

// ---------------------------------------------------------------------------
// Open URLs/files with system handler
// ---------------------------------------------------------------------------

/// Open a URL in the default browser or a file in the default app.
#[tauri::command]
pub(crate) async fn open_external(target: String) -> Result<(), String> {
    open::that(&target).map_err(|e| format!("failed to open: {e}"))
}

// ---------------------------------------------------------------------------
// File reading (for markdown sidebar)
// ---------------------------------------------------------------------------

/// Read a file's content as UTF-8 string. Used by the markdown sidebar.
#[tauri::command]
pub(crate) async fn read_file_content(path: String) -> Result<String, String> {
    let p = Path::new(&path);

    // Expand ~ to home dir
    let expanded = if path.starts_with("~/") {
        let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
        Path::new(&home).join(&path[2..])
    } else {
        p.to_path_buf()
    };

    if !expanded.exists() {
        return Err(format!("file not found: {}", expanded.display()));
    }
    if !expanded.is_file() {
        return Err(format!("not a file: {}", expanded.display()));
    }

    // Safety: limit to 2MB
    let meta = fs::metadata(&expanded).map_err(|e| format!("metadata error: {e}"))?;
    if meta.len() > 2_097_152 {
        return Err("file too large (>2MB)".to_string());
    }

    fs::read_to_string(&expanded).map_err(|e| format!("read error: {e}"))
}

// ---------------------------------------------------------------------------
// Project launcher
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ProjectEntry {
    pub name: String,
    pub path: String,
}

/// Lists all git repos under ~/Projects (or CORTEX_PROJECTS_DIR env var),
/// scanning up to 2 levels deep. Each entry shows `category/name` for
/// nested repos. Sorted alphabetically.
#[tauri::command]
pub(crate) async fn list_projects() -> Result<Vec<ProjectEntry>, String> {
    let home = std::env::var("HOME").map_err(|e| format!("HOME not set: {e}"))?;
    // Check env var first, then common locations
    let projects_dir = std::env::var("CORTEX_PROJECTS_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            let candidates = [
                Path::new(&home).join("Projects"),
                Path::new(&home).join("Desktop/Projects"),
                Path::new(&home).join("Developer"),
                Path::new(&home).join("dev"),
            ];
            candidates.into_iter().find(|p| p.is_dir())
                .unwrap_or_else(|| Path::new(&home).join("Projects"))
        });

    if !projects_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<ProjectEntry> = Vec::new();

    let top_dirs = match fs::read_dir(&projects_dir) {
        Ok(rd) => rd,
        Err(e) => return Err(format!("Failed to read projects directory: {e}")),
    };

    for top_entry in top_dirs.flatten() {
        let meta = match top_entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_dir() {
            continue;
        }
        let top_name = top_entry.file_name().to_string_lossy().into_owned();
        if top_name.starts_with('.') {
            continue;
        }

        let top_path = top_entry.path();

        // If this directory is itself a git repo, add it directly
        if top_path.join(".git").is_dir() {
            entries.push(ProjectEntry {
                name: top_name,
                path: top_path.to_string_lossy().into_owned(),
            });
            continue;
        }

        // Otherwise scan one level deeper (category folder)
        if let Ok(sub_dirs) = fs::read_dir(&top_path) {
            for sub_entry in sub_dirs.flatten() {
                let sub_meta = match sub_entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                if !sub_meta.is_dir() {
                    continue;
                }
                let sub_name = sub_entry.file_name().to_string_lossy().into_owned();
                if sub_name.starts_with('.') {
                    continue;
                }
                let display = format!("{top_name}/{sub_name}");
                let sub_path = sub_entry.path().to_string_lossy().into_owned();
                entries.push(ProjectEntry {
                    name: display,
                    path: sub_path,
                });
            }
        }
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(entries)
}
