use std::io::Write;
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use super::brain;
use super::types::{CortexConfig, ProviderKind};

/// Execute a query with conversation history and shared .cortex/ brain.
pub(crate) fn execute(
    query: &str,
    provider: ProviderKind,
    model: &str,
    config: &CortexConfig,
    cwd: Option<&str>,
    history: &[(String, String)],
) -> Result<String> {
    let system = brain::load_system_prompt();
    let project_ctx = brain::load_project_context(cwd).unwrap_or_default();

    match provider {
        ProviderKind::Claude => execute_claude(query, model, &system, &project_ctx, history),
        ProviderKind::Gemini => {
            let key = config.gemini_api_key.as_deref()
                .ok_or_else(|| anyhow::anyhow!("Gemini API key not configured"))?;
            execute_gemini(query, model, key, &system, &project_ctx, history)
        }
        ProviderKind::Ollama => execute_ollama(query, model, &config.ollama_endpoint, &system, &project_ctx, history),
    }
}

pub(crate) fn is_available(provider: ProviderKind, config: &CortexConfig) -> bool {
    match provider {
        ProviderKind::Claude => {
            Command::new("/opt/homebrew/bin/claude")
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        }
        ProviderKind::Gemini => config.gemini_api_key.is_some(),
        ProviderKind::Ollama => {
            reqwest::blocking::get(format!("{}/api/tags", config.ollama_endpoint))
                .map(|r| r.status().is_success())
                .unwrap_or(false)
        }
    }
}

/// Claude via CLI — pass history as conversation context in the prompt
fn execute_claude(
    query: &str,
    model: &str,
    system: &str,
    project_ctx: &str,
    history: &[(String, String)],
) -> Result<String> {
    let history_block = format_history_text(history);

    let full_prompt = if project_ctx.is_empty() {
        format!("{system}\n\n---\n{history_block}User: {query}")
    } else {
        format!("{system}\n\n---\nProject context:\n{project_ctx}\n\n---\n{history_block}User: {query}")
    };

    let mut child = Command::new("/opt/homebrew/bin/claude")
        .args(["-p", "--model", model])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn claude CLI")?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(full_prompt.as_bytes()).context("write failed")?;
    }

    let output = child.wait_with_output().context("claude wait failed")?;
    parse_output(&output.stdout, &output.stderr, output.status.success(), "claude")
}

/// Gemini via API — use proper multi-turn chat format
fn execute_gemini(
    query: &str,
    model: &str,
    api_key: &str,
    system: &str,
    project_ctx: &str,
    history: &[(String, String)],
) -> Result<String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    // Build multi-turn contents array
    let mut contents = Vec::new();

    // System instruction as first user message
    let sys_text = if project_ctx.is_empty() {
        system.to_string()
    } else {
        format!("{system}\n\nProject context:\n{project_ctx}")
    };
    contents.push(serde_json::json!({
        "role": "user",
        "parts": [{ "text": sys_text }]
    }));
    contents.push(serde_json::json!({
        "role": "model",
        "parts": [{ "text": "Understood. I am Cortex." }]
    }));

    // Conversation history
    for (role, content) in history {
        let gemini_role = if role == "user" { "user" } else { "model" };
        contents.push(serde_json::json!({
            "role": gemini_role,
            "parts": [{ "text": content }]
        }));
    }

    // Current query
    contents.push(serde_json::json!({
        "role": "user",
        "parts": [{ "text": query }]
    }));

    let body = serde_json::json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": 4096, "temperature": 0.7 }
    });

    let resp = reqwest::blocking::Client::new()
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .context("gemini request failed")?;

    let parsed: serde_json::Value = resp.json().context("gemini parse failed")?;
    if let Some(text) = parsed["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        Ok(text.to_string())
    } else if let Some(err) = parsed["error"]["message"].as_str() {
        anyhow::bail!("gemini: {err}")
    } else {
        anyhow::bail!("gemini: unexpected response")
    }
}

/// Ollama via /api/chat — proper multi-turn chat format
fn execute_ollama(
    query: &str,
    model: &str,
    endpoint: &str,
    system: &str,
    project_ctx: &str,
    history: &[(String, String)],
) -> Result<String> {
    // Build messages array for chat API
    let mut messages = Vec::new();

    // System message
    let sys_text = if project_ctx.is_empty() {
        system.to_string()
    } else {
        format!("{system}\n\nProject context:\n{project_ctx}")
    };
    messages.push(serde_json::json!({ "role": "system", "content": sys_text }));

    // Conversation history
    for (role, content) in history {
        messages.push(serde_json::json!({ "role": role, "content": content }));
    }

    // Current query
    messages.push(serde_json::json!({ "role": "user", "content": query }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    // Use /api/chat instead of /api/generate for multi-turn
    let resp = reqwest::blocking::Client::new()
        .post(format!("{endpoint}/api/chat"))
        .json(&body)
        .send()
        .context("ollama request failed")?;

    let status = resp.status();
    let raw = resp.text().context("ollama read body failed")?;

    if !status.is_success() {
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let detail = parsed["error"].as_str().unwrap_or(&raw);
        anyhow::bail!("ollama ({status}): {detail}");
    }

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .context("ollama json parse failed")?;

    // /api/chat returns message.content instead of response
    if let Some(text) = parsed["message"]["content"].as_str() {
        Ok(text.to_string())
    } else if let Some(text) = parsed["response"].as_str() {
        // Fallback for /api/generate format
        Ok(text.to_string())
    } else {
        anyhow::bail!("ollama: no content in: {}", &raw[..raw.len().min(200)])
    }
}

/// Format history as plain text for providers that need it (Claude CLI)
fn format_history_text(history: &[(String, String)]) -> String {
    if history.is_empty() {
        return String::new();
    }
    let mut out = String::from("Conversation history:\n");
    for (role, content) in history {
        let label = if role == "user" { "User" } else { "Cortex" };
        // Truncate very long messages in history to save tokens
        let trimmed = if content.len() > 500 {
            format!("{}...", &content[..500])
        } else {
            content.clone()
        };
        out.push_str(&format!("{label}: {trimmed}\n"));
    }
    out.push_str("\n---\n");
    out
}

fn parse_output(stdout: &[u8], stderr: &[u8], success: bool, name: &str) -> Result<String> {
    let out = String::from_utf8_lossy(stdout).to_string();
    let err = String::from_utf8_lossy(stderr).to_string();
    if !success {
        anyhow::bail!("{name}: {}", if err.trim().is_empty() { "exit error" } else { err.trim() });
    }
    if out.trim().is_empty() { Ok(format!("[no output] {}", err.trim())) } else { Ok(out) }
}
