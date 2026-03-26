use std::sync::Arc;

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
    app: AppHandle,
    config_state: State<'_, Arc<std::sync::Mutex<CortexConfig>>>,
    db: State<'_, Arc<Database>>,
) -> Result<(), String> {
    let config = config_state.lock().map_err(|_| "config mutex poisoned")?.clone();

    // Check budget
    let budget = db.get_budget_status(config.daily_budget_usd).map_err(to_err)?;

    // Strip # prefix and provider overrides
    let clean_query = query.strip_prefix('#').unwrap_or(&query).trim();
    let clean_query = router::strip_prefix(clean_query);

    // Route to provider (force local if budget capped)
    let (provider, model) = if budget.is_capped {
        (ProviderKind::Ollama, config.ollama_model.clone())
    } else {
        router::route_query(clean_query, &config)
    };

    let query_owned = clean_query.to_string();
    let pane_owned = pane_id.clone();
    let db_arc = Arc::clone(&db);

    // Execute in background — never block the IPC thread
    tokio::task::spawn_blocking(move || {
        let start = std::time::Instant::now();

        let result = providers::execute(&query_owned, provider, &model, &config, None);
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
