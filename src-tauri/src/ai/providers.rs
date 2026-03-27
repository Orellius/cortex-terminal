use std::io::{BufRead, Read, Write};
use std::process::{Command, Stdio};

use anyhow::{Context, Result};

use super::brain;
use super::types::{CortexConfig, ProviderKind};

/// Execute a query (blocking, no streaming). Wraps execute_streaming with a no-op callback.
pub(crate) fn execute(
    query: &str,
    provider: ProviderKind,
    model: &str,
    config: &CortexConfig,
    cwd: Option<&str>,
    history: &[(String, String)],
) -> Result<String> {
    execute_streaming(query, provider, model, config, cwd, history, |_| {}, None)
}

/// Execute a query with streaming support.
/// Calls `on_chunk` for each token/line as it arrives.
/// Returns the full accumulated response.
pub(crate) fn execute_streaming(
    query: &str,
    provider: ProviderKind,
    model: &str,
    config: &CortexConfig,
    cwd: Option<&str>,
    history: &[(String, String)],
    on_chunk: impl Fn(&str),
    mcp_tools_block: Option<&str>,
) -> Result<String> {
    let system = brain::load_system_prompt();
    let project_ctx = brain::load_project_context(cwd).unwrap_or_default();
    let env_ctx = cwd.map(brain::load_env_context).unwrap_or_default();
    let mcp_block = mcp_tools_block.unwrap_or("");

    let mut ctx_parts = Vec::new();
    if !env_ctx.is_empty() { ctx_parts.push(env_ctx); }
    if !project_ctx.is_empty() { ctx_parts.push(project_ctx); }
    if !mcp_block.is_empty() { ctx_parts.push(mcp_block.to_string()); }
    let combined_ctx = ctx_parts.join("\n\n");

    match provider {
        ProviderKind::Claude => {
            stream_claude(query, model, &system, &combined_ctx, history, &on_chunk)
        }
        ProviderKind::Gemini => {
            let key = config
                .gemini_api_key
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("Gemini API key not configured"))?;
            execute_gemini(query, model, key, &system, &combined_ctx, history)
        }
        ProviderKind::Ollama => {
            stream_ollama(query, model, &config.ollama_endpoint, &system, &combined_ctx, history, &on_chunk)
        }
    }
}

pub(crate) fn is_available(provider: ProviderKind, config: &CortexConfig) -> bool {
    match provider {
        ProviderKind::Claude => Command::new("/opt/homebrew/bin/claude")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false),
        ProviderKind::Gemini => config.gemini_api_key.is_some(),
        ProviderKind::Ollama => {
            reqwest::blocking::get(format!("{}/api/tags", config.ollama_endpoint))
                .map(|r| r.status().is_success())
                .unwrap_or(false)
        }
    }
}

// ─── Claude CLI — streaming stdout ──────────────────────────

fn stream_claude(
    query: &str,
    model: &str,
    system: &str,
    ctx: &str,
    history: &[(String, String)],
    on_chunk: &impl Fn(&str),
) -> Result<String> {
    let history_block = format_history_text(history);
    let full_prompt = if ctx.is_empty() {
        format!("{system}\n\n---\n{history_block}User: {query}")
    } else {
        format!("{system}\n\n---\nProject context:\n{ctx}\n\n---\n{history_block}User: {query}")
    };

    let mut child = Command::new("/opt/homebrew/bin/claude")
        .args(["-p", "--model", model])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn claude CLI")?;

    // Write prompt then close stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(full_prompt.as_bytes()).context("write failed")?;
    }

    // Drain stderr in background thread to prevent pipe deadlock
    let stderr_pipe = child.stderr.take();
    let stderr_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut err) = stderr_pipe {
            let _ = err.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).to_string()
    });

    // Stream stdout incrementally
    let stdout = child.stdout.take().context("no stdout")?;
    let mut reader = std::io::BufReader::new(stdout);
    let mut full_output = String::new();
    let mut buf = [0u8; 512];

    loop {
        let n = reader.read(&mut buf).context("stdout read failed")?;
        if n == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buf[..n]);
        full_output.push_str(&chunk);
        on_chunk(&chunk);
    }

    let status = child.wait().context("claude wait failed")?;
    let stderr_out = stderr_handle.join().unwrap_or_default();

    if !status.success() {
        let detail = if stderr_out.trim().is_empty() {
            "exit error"
        } else {
            stderr_out.trim()
        };
        anyhow::bail!("claude: {detail}");
    }

    if full_output.trim().is_empty() {
        Ok(format!("[no output] {}", stderr_out.trim()))
    } else {
        Ok(full_output)
    }
}

// ─── Ollama — NDJSON streaming ──────────────────────────────

fn stream_ollama(
    query: &str,
    model: &str,
    endpoint: &str,
    system: &str,
    ctx: &str,
    history: &[(String, String)],
    on_chunk: &impl Fn(&str),
) -> Result<String> {
    let mut messages = Vec::new();

    let sys_text = if ctx.is_empty() {
        system.to_string()
    } else {
        format!("{system}\n\nProject context:\n{ctx}")
    };
    messages.push(serde_json::json!({ "role": "system", "content": sys_text }));

    for (role, content) in history {
        messages.push(serde_json::json!({ "role": role, "content": content }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": query }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    let resp = reqwest::blocking::Client::new()
        .post(format!("{endpoint}/api/chat"))
        .json(&body)
        .send()
        .context("ollama request failed")?;

    if !resp.status().is_success() {
        let status = resp.status();
        let raw = resp.text().context("ollama read body failed")?;
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
        let detail = parsed["error"].as_str().unwrap_or(&raw);
        anyhow::bail!("ollama ({status}): {detail}");
    }

    // Read NDJSON stream — each line is a JSON object with message.content
    let mut reader = std::io::BufReader::new(resp);
    let mut full_output = String::new();
    let mut line_buf = String::new();

    loop {
        line_buf.clear();
        let bytes = reader.read_line(&mut line_buf).context("ollama stream read failed")?;
        if bytes == 0 {
            break;
        }

        let trimmed = line_buf.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if parsed["done"].as_bool() == Some(true) {
            break;
        }

        if let Some(token) = parsed["message"]["content"].as_str() {
            if !token.is_empty() {
                full_output.push_str(token);
                on_chunk(token);
            }
        }
    }

    if full_output.trim().is_empty() {
        anyhow::bail!("ollama: empty response");
    }

    Ok(full_output)
}

// ─── Gemini (blocking, removed from product) ────────────────

fn execute_gemini(
    query: &str,
    model: &str,
    api_key: &str,
    system: &str,
    ctx: &str,
    history: &[(String, String)],
) -> Result<String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let mut contents = Vec::new();
    let sys_text = if ctx.is_empty() {
        system.to_string()
    } else {
        format!("{system}\n\nProject context:\n{ctx}")
    };
    contents.push(serde_json::json!({"role":"user","parts":[{"text":sys_text}]}));
    contents.push(serde_json::json!({"role":"model","parts":[{"text":"Understood. I am Cortex."}]}));

    for (role, content) in history {
        let gemini_role = if role == "user" { "user" } else { "model" };
        contents.push(serde_json::json!({"role":gemini_role,"parts":[{"text":content}]}));
    }
    contents.push(serde_json::json!({"role":"user","parts":[{"text":query}]}));

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

// ─── Helpers ────────────────────────────────────────────────

fn format_history_text(history: &[(String, String)]) -> String {
    if history.is_empty() {
        return String::new();
    }
    let mut out = String::from("Conversation history:\n");
    for (role, content) in history {
        let label = if role == "user" { "User" } else { "Cortex" };
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
