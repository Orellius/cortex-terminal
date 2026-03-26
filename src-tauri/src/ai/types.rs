use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct AiRequest {
    pub query: String,
    pub provider_override: Option<ProviderKind>,
    pub pane_id: String,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct AiResponse {
    pub provider: ProviderKind,
    pub model: String,
    pub content: String,
    pub cost: f64,
    pub duration_ms: u64,
    pub verified: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ProviderKind {
    Claude,
    Gemini,
    Ollama,
}

impl std::fmt::Display for ProviderKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Claude => write!(f, "claude"),
            Self::Gemini => write!(f, "gemini"),
            Self::Ollama => write!(f, "ollama"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct CortexConfig {
    pub claude_model: String,
    pub gemini_model: String,
    pub gemini_api_key: Option<String>,
    pub ollama_model: String,
    pub ollama_endpoint: String,
    pub daily_budget_usd: f64,
}

impl Default for CortexConfig {
    fn default() -> Self {
        Self {
            claude_model: "sonnet".to_string(),
            gemini_model: "gemini-2.0-flash".to_string(),
            gemini_api_key: None,
            ollama_model: "nemotron-cascade-2".to_string(),
            ollama_endpoint: "http://localhost:11434".to_string(),
            daily_budget_usd: 5.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct CostEntry {
    pub provider: String,
    pub model: String,
    pub cost_usd: f64,
    pub query_preview: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ProviderStatus {
    pub name: String,
    pub kind: ProviderKind,
    pub available: bool,
    pub model: String,
}

/// Stream event emitted to frontend during AI response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct AiStreamEvent {
    pub pane_id: String,
    pub provider: ProviderKind,
    pub model: String,
    pub chunk: String,
    pub done: bool,
    pub cost: f64,
    pub duration_ms: u64,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct BudgetStatus {
    pub spent_today: f64,
    pub limit: f64,
    pub is_capped: bool,
}
