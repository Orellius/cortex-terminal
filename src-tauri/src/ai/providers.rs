use std::io::Write;
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use super::types::{CortexConfig, ProviderKind};

/// Execute a query against the specified provider.
pub(crate) fn execute(
    query: &str,
    provider: ProviderKind,
    model: &str,
    config: &CortexConfig,
) -> Result<String> {
    match provider {
        ProviderKind::Claude => execute_claude(query, model),
        ProviderKind::Gemini => {
            let key = config
                .gemini_api_key
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("Gemini API key not configured"))?;
            execute_gemini(query, model, key)
        }
        ProviderKind::Ollama => execute_ollama(query, model, &config.ollama_endpoint),
    }
}

/// Check if a provider is available on this system.
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

/// Claude Code CLI — pipe prompt via stdin.
fn execute_claude(query: &str, model: &str) -> Result<String> {
    let mut child = Command::new("/opt/homebrew/bin/claude")
        .args(["-p", "--model", model])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn claude CLI")?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(query.as_bytes()).context("failed to write to claude")?;
    }

    let output = child.wait_with_output().context("failed to wait for claude")?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        anyhow::bail!("claude: {}", if stderr.is_empty() { "exit error" } else { stderr.trim() });
    }

    Ok(if stdout.trim().is_empty() { format!("[no output] {}", stderr.trim()) } else { stdout })
}

/// Gemini API via reqwest (blocking).
fn execute_gemini(query: &str, model: &str, api_key: &str) -> Result<String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": query }] }],
        "generationConfig": { "maxOutputTokens": 4096, "temperature": 0.7 }
    });

    let response = reqwest::blocking::Client::new()
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .context("gemini request failed")?;

    let parsed: serde_json::Value = response.json().context("gemini response parse failed")?;

    if let Some(text) = parsed["candidates"][0]["content"]["parts"][0]["text"].as_str() {
        Ok(text.to_string())
    } else if let Some(err) = parsed["error"]["message"].as_str() {
        anyhow::bail!("gemini: {err}")
    } else {
        anyhow::bail!("gemini: unexpected response format")
    }
}

/// Ollama local model via HTTP API.
fn execute_ollama(query: &str, model: &str, endpoint: &str) -> Result<String> {
    let body = serde_json::json!({
        "model": model,
        "prompt": query,
        "stream": false
    });

    let response = reqwest::blocking::Client::new()
        .post(format!("{endpoint}/api/generate"))
        .json(&body)
        .send()
        .context("ollama request failed")?;

    let parsed: serde_json::Value = response.json().context("ollama response parse failed")?;

    if let Some(text) = parsed["response"].as_str() {
        Ok(text.to_string())
    } else {
        anyhow::bail!("ollama: unexpected response format")
    }
}
