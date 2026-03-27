use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::ai::config;
use crate::ai::database::Database;
use crate::ai::providers;
use crate::ai::router;
use crate::ai::types::{
    AiStreamEvent, BudgetStatus, CortexConfig, CostEntry, ProviderKind, ProviderStatus,
};
use crate::ai::verification;

fn to_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub(crate) async fn check_providers(
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
) -> Result<Vec<ProviderStatus>, String> {
    let config = {
        let guard = config_state.lock().map_err(|_| "config mutex poisoned".to_string())?;
        guard.clone()
    };

    // Run blocking availability checks in spawn_blocking to avoid Tokio panic
    let config_clone = config.clone();
    let statuses = tokio::task::spawn_blocking(move || {
        vec![
            ProviderStatus {
                name: "Claude".into(),
                kind: ProviderKind::Claude,
                available: providers::is_available(ProviderKind::Claude, &config_clone),
                model: config_clone.claude_model.clone(),
            },
            ProviderStatus {
                name: "Gemini".into(),
                kind: ProviderKind::Gemini,
                available: providers::is_available(ProviderKind::Gemini, &config_clone),
                model: config_clone.gemini_model.clone(),
            },
            ProviderStatus {
                name: "Ollama".into(),
                kind: ProviderKind::Ollama,
                available: providers::is_available(ProviderKind::Ollama, &config_clone),
                model: config_clone.ollama_model.clone(),
            },
        ]
    })
    .await
    .map_err(|e| format!("provider check failed: {e}"))?;

    Ok(statuses)
}

#[tauri::command]
pub(crate) async fn send_ai_query(
    query: String,
    pane_id: String,
    conversation_id: Option<String>,
    app: AppHandle,
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
    db: State<'_, Arc<Database>>,
) -> Result<(), String> {
    let config = config_state.lock().map_err(|_| "config mutex poisoned")?.clone();

    // Check budget
    let budget = db.get_budget_status(config.daily_budget_usd).map_err(to_err)?;

    // Strip # prefix only (keep provider prefix for routing)
    let without_hash = query.strip_prefix('#').unwrap_or(&query).trim();

    // Route FIRST (needs to see c:/g:/l: prefix), THEN strip for the actual prompt
    let (provider, model) = if budget.is_capped {
        (ProviderKind::Ollama, config.ollama_model.clone())
    } else {
        router::route_query(without_hash, &config)
    };

    // Now strip the provider prefix for the actual query sent to the model
    let clean_query = router::strip_prefix(without_hash);
    let query_owned = clean_query.to_string();
    let pane_owned = pane_id.clone();
    let db_arc = Arc::clone(&db);

    // Load conversation history for context (last 20 messages max)
    let history = conversation_id
        .as_ref()
        .and_then(|cid| db.get_messages(cid).ok())
        .unwrap_or_default();

    // Build history string for context (limit to last 20 messages to stay within token limits)
    let history_context: Vec<(String, String)> = history
        .iter()
        .rev()
        .take(20)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|m| (m.role.clone(), m.content.clone()))
        .collect();

    // Execute in background — never block the IPC thread
    tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();

        let result = providers::execute(&query_owned, provider, &model, &config, None, &history_context);
        let duration_ms = start.elapsed().as_millis() as u64;

        let (content, cost, verified) = match result {
            Ok(output) => {
                let check = verification::verify(&output, &query_owned);
                let cost = estimate_cost(provider, &output);

                // Log cost
                let _ = db_arc.log_cost(&CostEntry {
                    provider: provider.to_string(),
                    model: model.clone(),
                    cost_usd: cost,
                    query_preview: truncate(&query_owned, 100),
                    created_at: chrono::Utc::now().to_rfc3339(),
                });

                if check.passed {
                    (output, cost, true)
                } else {
                    let flags = check.flags.join(", ");
                    (format!("[verification failed: {flags}]\n{output}"), cost, false)
                }
            }
            Err(e) => (format!("error: {e}"), 0.0, false),
        };

        let _ = app.emit(
            "cortex:ai:stream",
            AiStreamEvent {
                pane_id: pane_owned,
                provider,
                model,
                chunk: content,
                done: true,
                cost,
                duration_ms,
                verified,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub(crate) async fn get_ai_config(
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
) -> Result<CortexConfig, String> {
    let config = config_state.lock().map_err(|_| "config mutex poisoned")?;
    Ok(config.clone())
}

#[tauri::command]
pub(crate) async fn update_ai_config(
    new_config: CortexConfig,
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
) -> Result<(), String> {
    config::save_config(&new_config).map_err(to_err)?;
    let mut config = config_state.lock().map_err(|_| "config mutex poisoned")?;
    *config = new_config;
    Ok(())
}

#[tauri::command]
pub(crate) async fn get_budget_status(
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
    db: State<'_, Arc<Database>>,
) -> Result<BudgetStatus, String> {
    let config = config_state.lock().map_err(|_| "config mutex poisoned")?;
    db.get_budget_status(config.daily_budget_usd).map_err(to_err)
}

/// Rough cost estimation per provider.
fn estimate_cost(provider: ProviderKind, output: &str) -> f64 {
    let tokens = output.len() as f64 / 4.0; // ~4 chars per token
    match provider {
        ProviderKind::Claude => tokens * 0.000015, // ~$15/1M output tokens (sonnet)
        ProviderKind::Gemini => 0.0,               // free tier
        ProviderKind::Ollama => 0.0,               // local
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max { s.to_string() } else { format!("{}...", &s[..max]) }
}

// ─── Auto-detection commands ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct DetectedCli {
    pub name: String,
    pub path: String,
    pub version: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified_at: String,
}

/// Scan for available AI CLIs on the system.
#[tauri::command]
pub(crate) async fn scan_ai_clis() -> Result<Vec<DetectedCli>, String> {
    tokio::task::spawn_blocking(|| {
        let mut clis = Vec::new();

        // Claude CLI
        clis.push(detect_cli("claude", &["/opt/homebrew/bin/claude", "/usr/local/bin/claude"]));
        // Ollama
        clis.push(detect_cli("ollama", &["/opt/homebrew/bin/ollama", "/usr/local/bin/ollama"]));
        // Aider
        clis.push(detect_cli("aider", &["/opt/homebrew/bin/aider", "/usr/local/bin/aider"]));

        clis
    })
    .await
    .map_err(|e| format!("scan failed: {e}"))
}

/// List locally available Ollama models.
#[tauri::command]
pub(crate) async fn list_ollama_models(
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
) -> Result<Vec<OllamaModel>, String> {
    let endpoint = {
        let config = config_state.lock().map_err(|_| "config mutex poisoned")?;
        config.ollama_endpoint.clone()
    };

    tokio::task::spawn_blocking(move || {
        let resp = reqwest::blocking::get(format!("{endpoint}/api/tags"))
            .map_err(|e| format!("ollama unreachable: {e}"))?;
        let parsed: serde_json::Value = resp.json().map_err(|e| format!("parse error: {e}"))?;

        let models = parsed["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|m| OllamaModel {
                        name: m["name"].as_str().unwrap_or("").to_string(),
                        size: format_bytes(m["size"].as_u64().unwrap_or(0)),
                        modified_at: m["modified_at"].as_str().unwrap_or("").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    })
    .await
    .map_err(|e| format!("task failed: {e}"))?
}

fn detect_cli(name: &str, paths: &[&str]) -> DetectedCli {
    use std::process::{Command, Stdio};

    for path in paths {
        if let Ok(output) = Command::new(path)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
        {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let version = if version.is_empty() {
                    String::from_utf8_lossy(&output.stderr).trim().to_string()
                } else {
                    version
                };
                return DetectedCli {
                    name: name.to_string(),
                    path: path.to_string(),
                    version: version.lines().next().unwrap_or("unknown").to_string(),
                    available: true,
                };
            }
        }
    }

    DetectedCli {
        name: name.to_string(),
        path: String::new(),
        version: String::new(),
        available: false,
    }
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else {
        format!("{} B", bytes)
    }
}
