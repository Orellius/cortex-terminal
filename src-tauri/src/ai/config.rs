use std::path::PathBuf;

use anyhow::{Context, Result};

use super::types::CortexConfig;

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
