use super::types::{CortexConfig, ProviderKind};

/// Routes a query to the best provider based on complexity scoring.
/// No ML — deterministic keyword-based routing.
pub(crate) fn route_query(query: &str, config: &CortexConfig) -> (ProviderKind, String) {
    let lower = query.to_lowercase();

    // Explicit provider override: #claude:, #gemini:, #local:
    if lower.starts_with("claude:") || lower.starts_with("c:") {
        return (ProviderKind::Claude, config.claude_model.clone());
    }
    if lower.starts_with("gemini:") || lower.starts_with("g:") {
        return (ProviderKind::Gemini, config.gemini_model.clone());
    }
    if lower.starts_with("local:") || lower.starts_with("l:") {
        return (ProviderKind::Ollama, config.ollama_model.clone());
    }

    let score = complexity_score(&lower);

    if score >= 5 {
        // Complex: code generation, debugging, implementation
        (ProviderKind::Claude, config.claude_model.clone())
    } else if score >= 3 {
        // Medium: research, explanation, comparison
        (ProviderKind::Gemini, config.gemini_model.clone())
    } else {
        // Simple: short questions, formatting, quick lookups
        (ProviderKind::Ollama, config.ollama_model.clone())
    }
}

/// Score query complexity 0-10 based on word-level signals.
/// Uses individual word matching — "fix the bug" matches "fix" and "bug" separately.
fn complexity_score(query: &str) -> u8 {
    let mut score: u8 = 0;
    let words: Vec<&str> = query.split_whitespace().collect();

    // Code execution signals → high complexity (Claude)
    // Individual words: any single match = strong code signal
    let code_words = [
        "implement", "build", "fix", "debug", "refactor", "deploy", "publish",
        "commit", "compile", "migration", "scaffold", "architect", "optimize",
    ];
    for word in &code_words {
        if words.iter().any(|w| w.trim_matches(|c: char| !c.is_alphanumeric()) == *word) {
            score = score.saturating_add(5);
            break; // One code word is enough for Claude
        }
    }

    // Secondary code signals — boost if already in code territory
    let code_context_words = [
        "bug", "error", "crash", "feature", "function", "component", "endpoint",
        "api", "route", "schema", "query", "mutation", "test", "tests",
        "cargo", "npm", "git", "rust", "typescript", "react", "tauri",
    ];
    for word in &code_context_words {
        if words.iter().any(|w| w.trim_matches(|c: char| !c.is_alphanumeric()) == *word) {
            score = score.saturating_add(2);
            break;
        }
    }

    // Research signals → medium complexity (Gemini)
    let research_words = [
        "explain", "compare", "analyze", "research", "summarize",
        "alternative", "competitor", "trend", "review", "difference",
    ];
    for word in &research_words {
        if words.iter().any(|w| w.trim_matches(|c: char| !c.is_alphanumeric()) == *word) {
            score = score.saturating_add(3);
            break;
        }
    }

    // Phrase-level research signals (multi-word patterns)
    let research_phrases = ["what is", "how does", "how to", "pros and cons", "difference between"];
    for phrase in &research_phrases {
        if query.contains(phrase) {
            score = score.saturating_add(3);
            break;
        }
    }

    // Code syntax signals → strong Claude indicator
    if query.contains("```") || query.contains("fn ") || query.contains("function ")
        || query.contains("class ") || query.contains("import ") || query.contains("async ")
        || query.contains("pub ") || query.contains("struct ") || query.contains("const ")
    {
        score = score.saturating_add(5);
    }

    // File extension references → code context
    if query.contains(".rs") || query.contains(".ts") || query.contains(".tsx")
        || query.contains(".js") || query.contains(".py") || query.contains(".toml")
    {
        score = score.saturating_add(3);
    }

    // Long query → likely complex
    if words.len() > 50 {
        score = score.saturating_add(2);
    }

    score.min(10)
}

/// Strip the provider prefix from a query if present.
pub(crate) fn strip_prefix(query: &str) -> &str {
    let prefixes = ["claude:", "c:", "gemini:", "g:", "local:", "l:"];
    for prefix in prefixes {
        if let Some(stripped) = query.strip_prefix(prefix) {
            return stripped.trim();
        }
    }
    // Case-insensitive check
    let lower = query.to_lowercase();
    for prefix in prefixes {
        if lower.starts_with(prefix) {
            return &query[prefix.len()..].trim_start();
        }
    }
    query
}
