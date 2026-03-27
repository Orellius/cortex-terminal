use std::io::Write;
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use super::brain;
use super::types::{CortexConfig, ProviderKind};

/// Execute a query with the shared .cortex/ brain prepended.
pub(crate) fn execute(
    query: &str,
    provider: ProviderKind,
    model: &str,
    config: &CortexConfig,
    cwd: Option<&str>,
) -> Result<String> {
    let system = brain::load_system_prompt();
    let project_ctx = brain::load_project_context(cwd).unwrap_or_default();

    let full_prompt = if project_ctx.is_empty() {
        format!("{system}\n\n---\nUser query: {query}")
    } else {
        format!("{system}\n\n---\nProject context:\n{project_ctx}\n\n---\nUser query: {query}")
    };

    match provider {
        ProviderKind::Claude => execute_claude(&full_prompt, model),
        ProviderKind::Gemini => {
            let key = config.gemini_api_key.as_deref()
                .ok_or_else(|| anyhow::anyhow!("Gemini API key not configured"))?;
            execute_gemini(&full_prompt, model, key)
        }
        ProviderKind::Ollama => execute_ollama(&full_prompt, model, &config.ollama_endpoint),
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

fn execute_claude(prompt: &str, model: &str) -> Result<String> {
    let mut child = Command::new("/opt/homebrew/bin/claude")
        .args(["-p", "--model", model])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn claude CLI")?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes()).context("write failed")?;
    }

    let output = child.wait_with_output().context("claude wait failed")?;
    parse_output(&output.stdout, &output.stderr, output.status.success(), "claude")
}

fn execute_gemini(prompt: &str, model: &str, api_key: &str) -> Result<String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );
    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
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

fn execute_ollama(prompt: &str, model: &str, endpoint: &str) -> Result<String> {
    let body = serde_json::json!({ "model": model, "prompt": prompt, "stream": false });
    let resp = reqwest::blocking::Client::new()
        .post(format!("{endpoint}/api/generate"))
        .json(&body)
        .send()
        .context("ollama request failed")?;

    let status = resp.status();
    let raw = resp.text().context("ollama read body failed")?;

    if !status.is_success() {
        // Ollama returns error details in the body
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let detail = parsed["error"].as_str().unwrap_or(&raw);
        anyhow::bail!("ollama ({status}): {detail}");
    }

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .context("ollama json parse failed")?;

    if let Some(text) = parsed["response"].as_str() {
        Ok(text.to_string())
    } else {
        anyhow::bail!("ollama: no 'response' field in: {}", &raw[..raw.len().min(200)])
    }
}

fn parse_output(stdout: &[u8], stderr: &[u8], success: bool, name: &str) -> Result<String> {
    let out = String::from_utf8_lossy(stdout).to_string();
    let err = String::from_utf8_lossy(stderr).to_string();
    if !success {
        anyhow::bail!("{name}: {}", if err.trim().is_empty() { "exit error" } else { err.trim() });
    }
    if out.trim().is_empty() { Ok(format!("[no output] {}", err.trim())) } else { Ok(out) }
}
