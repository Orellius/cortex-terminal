//! Provider Registry: config-driven multi-LLM support.
//!
//! 17/20 cloud providers use OpenAI-compatible SSE endpoints.
//! One generic streaming client handles them all. Provider
//! definitions live in ~/.cortex/providers.toml.

use std::io::{BufRead, Write};
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// A configured LLM provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ProviderEntry {
    pub name: String,
    pub endpoint: String,
    #[serde(default)]
    pub api_key_env: String, // env var name, e.g. "OPENAI_API_KEY"
    #[serde(default)]
    pub api_key: Option<String>, // direct key (not recommended, use env)
    #[serde(default)]
    pub models: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_format")]
    pub format: StreamFormat,
    #[serde(default)]
    pub auth_header: String, // default: "Authorization: Bearer {key}"
    #[serde(default)]
    pub extra_headers: Vec<(String, String)>,
}

fn default_true() -> bool { true }
fn default_format() -> StreamFormat { StreamFormat::OpenAiSse }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum StreamFormat {
    OpenAiSse,    // Most providers: SSE with data: {json}\n\n
    AnthropicSse, // Anthropic: SSE with content_block_delta events
    Ndjson,       // Ollama native: newline-delimited JSON
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct ProviderRegistry {
    #[serde(default)]
    pub providers: Vec<ProviderEntry>,
}

impl ProviderRegistry {
    /// Load from ~/.cortex/providers.toml. Creates defaults if missing.
    pub fn load() -> Result<Self> {
        let path = providers_path();
        if !path.exists() {
            let registry = Self::defaults();
            registry.save()?;
            return Ok(registry);
        }
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("cannot read {}", path.display()))?;
        toml::from_str(&content).context("invalid providers.toml")
    }

    pub fn save(&self) -> Result<()> {
        let dir = cortex_dir();
        std::fs::create_dir_all(&dir)?;
        let content = toml::to_string_pretty(self)?;
        std::fs::write(providers_path(), content)?;
        Ok(())
    }

    /// Get all enabled providers with valid API keys
    pub fn active_providers(&self) -> Vec<&ProviderEntry> {
        self.providers.iter().filter(|p| {
            p.enabled && (resolve_key(p).is_some() || p.endpoint.contains("localhost"))
        }).collect()
    }

    /// Find a provider by name
    pub fn get(&self, name: &str) -> Option<&ProviderEntry> {
        self.providers.iter().find(|p| p.name.eq_ignore_ascii_case(name))
    }

    /// Default provider registry with all 26 providers
    fn defaults() -> Self {
        Self {
            providers: vec![
                // Cloud: OpenAI-compatible SSE
                entry("openai", "https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY",
                    &["gpt-5-mini", "gpt-4.1", "gpt-5", "o3", "o4-mini"]),
                entry("anthropic-api", "https://api.anthropic.com/v1/messages", "ANTHROPIC_API_KEY",
                    &["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"])
                    .with_format(StreamFormat::AnthropicSse)
                    .with_header("anthropic-version", "2023-06-01"),
                entry("gemini", "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent", "GEMINI_API_KEY",
                    &["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]),
                entry("mistral", "https://api.mistral.ai/v1/chat/completions", "MISTRAL_API_KEY",
                    &["mistral-large-3", "mistral-small-3", "codestral", "mistral-nemo"]),
                entry("deepseek", "https://api.deepseek.com/v1/chat/completions", "DEEPSEEK_API_KEY",
                    &["deepseek-chat", "deepseek-reasoner", "deepseek-v4"]),
                entry("groq", "https://api.groq.com/openai/v1/chat/completions", "GROQ_API_KEY",
                    &["llama-3.3-70b", "llama-4-scout", "gpt-oss-20b"]),
                entry("xai", "https://api.x.ai/v1/chat/completions", "XAI_API_KEY",
                    &["grok-4", "grok-4.1-fast"]),
                entry("together", "https://api.together.xyz/v1/chat/completions", "TOGETHER_API_KEY",
                    &["meta-llama/Llama-4-Maverick-405B", "meta-llama/Llama-3.3-70B"]),
                entry("cerebras", "https://api.cerebras.ai/v1/chat/completions", "CEREBRAS_API_KEY",
                    &["llama3.1-8b", "llama3.3-70b"]),
                entry("cohere", "https://api.cohere.com/v2/chat", "COHERE_API_KEY",
                    &["command-r-plus", "command-r", "command-a"]),
                entry("perplexity", "https://api.perplexity.ai/chat/completions", "PERPLEXITY_API_KEY",
                    &["sonar", "sonar-pro", "sonar-reasoning"]),
                entry("fireworks", "https://api.fireworks.ai/inference/v1/chat/completions", "FIREWORKS_API_KEY",
                    &["accounts/fireworks/models/llama-v3p3-70b-instruct"]),
                entry("alibaba", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "DASHSCOPE_API_KEY",
                    &["qwen-max", "qwen-plus", "qwen-turbo"]),
                entry("ai21", "https://api.ai21.com/studio/v1/chat/completions", "AI21_API_KEY",
                    &["jamba-1.6-mini", "jamba-large-1.7"]),
                entry("reka", "https://api.reka.ai/v1/chat", "REKA_API_KEY",
                    &["reka-flash-3", "reka-core"]),
                entry("replicate", "https://api.replicate.com/v1/predictions", "REPLICATE_API_TOKEN",
                    &[]),
                // Local: always available
                local("ollama", "http://localhost:11434/api/chat", StreamFormat::Ndjson,
                    &[]),
                local("lm-studio", "http://localhost:1234/v1/chat/completions", StreamFormat::OpenAiSse,
                    &[]),
                local("llama-cpp", "http://localhost:8080/v1/chat/completions", StreamFormat::OpenAiSse,
                    &[]),
                local("vllm", "http://localhost:8000/v1/chat/completions", StreamFormat::OpenAiSse,
                    &[]),
                local("localai", "http://localhost:8080/v1/chat/completions", StreamFormat::OpenAiSse,
                    &[]),
                local("jan", "http://localhost:1337/v1/chat/completions", StreamFormat::OpenAiSse,
                    &[]),
            ],
        }
    }
}

/// Resolve the API key for a provider (env var first, then direct)
pub(crate) fn resolve_key(provider: &ProviderEntry) -> Option<String> {
    if !provider.api_key_env.is_empty() {
        if let Ok(key) = std::env::var(&provider.api_key_env) {
            if !key.is_empty() { return Some(key); }
        }
    }
    provider.api_key.clone().filter(|k| !k.is_empty())
}

/// Execute a query against any OpenAI-compatible provider with streaming
pub(crate) fn stream_openai_compat(
    provider: &ProviderEntry,
    model: &str,
    system: &str,
    messages: &[(String, String)],
    query: &str,
    on_chunk: &impl Fn(&str),
) -> Result<String> {
    let key = resolve_key(provider);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let mut chat_messages = Vec::new();
    if !system.is_empty() {
        chat_messages.push(serde_json::json!({"role": "system", "content": system}));
    }
    for (role, content) in messages {
        chat_messages.push(serde_json::json!({"role": role, "content": content}));
    }
    chat_messages.push(serde_json::json!({"role": "user", "content": query}));

    let body = serde_json::json!({
        "model": model,
        "messages": chat_messages,
        "stream": true,
    });

    let mut req = client.post(&provider.endpoint).json(&body);
    if let Some(ref k) = key {
        req = req.header("Authorization", format!("Bearer {k}"));
    }
    for (name, value) in &provider.extra_headers {
        req = req.header(name.as_str(), value.as_str());
    }

    let resp = req.send().context("request failed")?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        anyhow::bail!("{} ({}): {}", provider.name, status, &text[..text.len().min(200)]);
    }

    let mut reader = std::io::BufReader::new(resp);
    let mut full_output = String::new();
    let mut line_buf = String::new();

    loop {
        line_buf.clear();
        let bytes = reader.read_line(&mut line_buf)?;
        if bytes == 0 { break; }

        let trimmed = line_buf.trim();
        if trimmed.is_empty() || trimmed == "data: [DONE]" { continue; }

        let json_str = trimmed.strip_prefix("data: ").unwrap_or(trimmed);
        let parsed: serde_json::Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(_) => continue,
        };

        // OpenAI format: choices[0].delta.content
        if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
            if !content.is_empty() {
                full_output.push_str(content);
                on_chunk(content);
            }
        }
        // Ollama NDJSON format: message.content
        else if let Some(content) = parsed["message"]["content"].as_str() {
            if !content.is_empty() {
                full_output.push_str(content);
                on_chunk(content);
            }
            if parsed["done"].as_bool() == Some(true) { break; }
        }
    }

    if full_output.trim().is_empty() {
        anyhow::bail!("{}: empty response", provider.name);
    }
    Ok(full_output)
}

// ─── Helpers ────────────────────────────────────────────────

fn cortex_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cortex")
}

fn providers_path() -> PathBuf {
    cortex_dir().join("providers.toml")
}

fn entry(name: &str, endpoint: &str, key_env: &str, models: &[&str]) -> ProviderEntry {
    ProviderEntry {
        name: name.to_string(),
        endpoint: endpoint.to_string(),
        api_key_env: key_env.to_string(),
        api_key: None,
        models: models.iter().map(|s| s.to_string()).collect(),
        enabled: true,
        format: StreamFormat::OpenAiSse,
        auth_header: String::new(),
        extra_headers: Vec::new(),
    }
}

fn local(name: &str, endpoint: &str, format: StreamFormat, models: &[&str]) -> ProviderEntry {
    ProviderEntry {
        name: name.to_string(),
        endpoint: endpoint.to_string(),
        api_key_env: String::new(),
        api_key: None,
        models: models.iter().map(|s| s.to_string()).collect(),
        enabled: true,
        format,
        auth_header: String::new(),
        extra_headers: Vec::new(),
    }
}

impl ProviderEntry {
    fn with_format(mut self, format: StreamFormat) -> Self {
        self.format = format;
        self
    }
    fn with_header(mut self, name: &str, value: &str) -> Self {
        self.extra_headers.push((name.to_string(), value.to_string()));
        self
    }
}
