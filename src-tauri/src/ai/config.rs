use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::types::CortexConfig;

/// MCP server definition stored in ~/.cortex/mcp.toml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct McpServerEntry {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct McpConfig {
    #[serde(default)]
    pub servers: Vec<McpServerEntry>,
}

/// Returns the config directory path (~/.cortex/).
fn config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cortex")
}

/// Returns the config file path (~/.cortex/config.toml).
fn config_path() -> PathBuf {
    config_dir().join("config.toml")
}

/// Load config from ~/.cortex/config.toml. Creates default if missing.
pub(crate) fn load_config() -> Result<CortexConfig> {
    let path = config_path();

    if !path.exists() {
        let config = CortexConfig::default();
        save_config(&config)?;
        return Ok(config);
    }

    let content = std::fs::read_to_string(&path)
        .with_context(|| format!("cannot read config: {}", path.display()))?;

    let config: CortexConfig = toml::from_str(&content)
        .with_context(|| "invalid config.toml format")?;

    Ok(config)
}

/// Save config to ~/.cortex/config.toml.
pub(crate) fn save_config(config: &CortexConfig) -> Result<()> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("cannot create config dir: {}", dir.display()))?;

    let content = toml::to_string_pretty(config)
        .context("cannot serialize config")?;

    std::fs::write(config_path(), content)
        .context("cannot write config.toml")?;

    Ok(())
}

// ─── MCP Config (~/.cortex/mcp.toml) ────────────────────────

fn mcp_path() -> PathBuf {
    config_dir().join("mcp.toml")
}

pub(crate) fn load_mcp_config() -> Result<McpConfig> {
    let path = mcp_path();
    if !path.exists() {
        return Ok(McpConfig::default());
    }
    let content = std::fs::read_to_string(&path)
        .with_context(|| format!("cannot read mcp config: {}", path.display()))?;
    toml::from_str(&content).context("invalid mcp.toml format")
}

pub(crate) fn save_mcp_config(config: &McpConfig) -> Result<()> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir)?;
    let content = toml::to_string_pretty(config).context("cannot serialize mcp config")?;
    std::fs::write(mcp_path(), content).context("cannot write mcp.toml")
}

/// Parse ~/.claude/settings.json and extract mcpServers entries.
pub(crate) fn import_mcp_from_claude() -> Result<Vec<McpServerEntry>> {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = PathBuf::from(&home).join(".claude").join("settings.json");
    if !path.exists() {
        anyhow::bail!("~/.claude/settings.json not found");
    }
    let content = std::fs::read_to_string(&path).context("cannot read settings.json")?;
    let parsed: serde_json::Value = serde_json::from_str(&content).context("invalid JSON")?;

    let mut servers = Vec::new();
    if let Some(mcp_servers) = parsed.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, config) in mcp_servers {
            let command = config.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let args: Vec<String> = config.get("args")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|a| a.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if !command.is_empty() {
                servers.push(McpServerEntry { name: name.clone(), command, args, enabled: true });
            }
        }
    }

    Ok(servers)
}
