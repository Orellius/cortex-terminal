use std::path::PathBuf;

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

fn read_file(path: &PathBuf) -> Option<String> {
    std::fs::read_to_string(path).ok().filter(|s| !s.trim().is_empty())
}
