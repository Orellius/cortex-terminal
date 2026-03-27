use std::path::PathBuf;
use std::process::Command;

/// Loads the shared .cortex/ brain files and builds a system prompt
/// that all models receive. This is how multiple models share one brain.
pub(crate) fn load_system_prompt() -> String {
    let cortex_dir = cortex_dir();
    let mut parts = Vec::new();

    // Identity — who we are
    if let Some(content) = read_file(&cortex_dir.join("identity.md")) {
        parts.push(content);
    }

    // Active project context
    if let Some(content) = read_file(&cortex_dir.join("context/active-project.md")) {
        parts.push(content);
    }

    // Rules — load all .md files from rules/
    let rules_dir = cortex_dir.join("rules");
    if let Ok(entries) = std::fs::read_dir(&rules_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                if let Some(content) = read_file(&path) {
                    parts.push(content);
                }
            }
        }
    }

    if parts.is_empty() {
        return "You are a helpful AI assistant in the Cortex terminal.".to_string();
    }

    parts.join("\n\n---\n\n")
}

/// Also load project-local .cortex/ if it exists in the cwd
pub(crate) fn load_project_context(cwd: Option<&str>) -> Option<String> {
    let cwd = cwd?;
    let project_cortex = PathBuf::from(cwd).join(".cortex");
    if !project_cortex.exists() {
        return None;
    }

    let mut parts = Vec::new();
    if let Some(c) = read_file(&project_cortex.join("context.md")) {
        parts.push(c);
    }
    if let Some(c) = read_file(&project_cortex.join("rules.md")) {
        parts.push(c);
    }

    if parts.is_empty() { None } else { Some(parts.join("\n\n")) }
}

fn cortex_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cortex")
}

/// Collect dynamic environment context from the working directory.
/// Gives models awareness of: cwd, git state, project files, and CLAUDE.md.
pub(crate) fn load_env_context(cwd: &str) -> String {
    let path = PathBuf::from(cwd);
    if !path.is_dir() {
        return String::new();
    }

    let mut parts = Vec::new();
    parts.push(format!("Working directory: {cwd}"));

    // Git branch
    if let Ok(out) = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
    {
        if out.status.success() {
            let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
            parts.push(format!("Git branch: {branch}"));
        }
    }

    // Git status (short, max 20 lines)
    if let Ok(out) = Command::new("git")
        .args(["status", "--short"])
        .current_dir(&path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
    {
        if out.status.success() {
            let raw = String::from_utf8_lossy(&out.stdout);
            let status: String = raw.lines().take(20).collect::<Vec<_>>().join("\n");
            if !status.is_empty() {
                parts.push(format!("Git changes:\n{status}"));
            }
        }
    }

    // File listing (top level, sorted, max 40)
    if let Ok(entries) = std::fs::read_dir(&path) {
        let mut files: Vec<String> = entries
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with('.') && name != ".cortex" {
                    return None; // Skip hidden files except .cortex
                }
                let suffix = if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    "/"
                } else {
                    ""
                };
                Some(format!("{name}{suffix}"))
            })
            .collect();
        files.sort();
        files.truncate(40);
        if !files.is_empty() {
            parts.push(format!("Project files: {}", files.join(", ")));
        }
    }

    // Detect project type from manifest files
    let mut project_signals = Vec::new();
    if path.join("Cargo.toml").exists() {
        project_signals.push("Rust");
    }
    if path.join("package.json").exists() {
        project_signals.push("Node.js");
    }
    if path.join("src-tauri").exists() {
        project_signals.push("Tauri");
    }
    if path.join("tsconfig.json").exists() {
        project_signals.push("TypeScript");
    }
    if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        project_signals.push("Python");
    }
    if !project_signals.is_empty() {
        parts.push(format!("Stack: {}", project_signals.join(" + ")));
    }

    // CLAUDE.md — project context file (first 60 lines)
    if let Some(content) = read_file(&path.join("CLAUDE.md")) {
        let truncated: String = content.lines().take(60).collect::<Vec<_>>().join("\n");
        parts.push(format!("Project brief (CLAUDE.md):\n{truncated}"));
    }

    parts.join("\n")
}

fn read_file(path: &PathBuf) -> Option<String> {
    std::fs::read_to_string(path).ok().filter(|s| !s.trim().is_empty())
}
