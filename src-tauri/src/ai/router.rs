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

    if score >= 7 {
        // Complex: code generation, debugging, implementation
        (ProviderKind::Claude, config.claude_model.clone())
    } else if score >= 4 {
        // Medium: research, explanation, comparison
        (ProviderKind::Gemini, config.gemini_model.clone())
    } else {
        // Simple: short questions, formatting, quick lookups
        (ProviderKind::Ollama, config.ollama_model.clone())
    }
}

/// Score query complexity 0-10 based on keyword signals.
fn complexity_score(query: &str) -> u8 {
    let mut score: u8 = 0;

    // Code execution signals → high complexity (Claude)
    let code_keywords = [
        "implement", "build", "write code", "fix bug", "debug", "refactor",
        "create file", "add feature", "deploy", "publish", "commit", "push",
        "cargo", "npm", "git", "test", "compile", "migration",
    ];
    for kw in code_keywords {
        if query.contains(kw) {
            score = score.saturating_add(3);
        }
    }

    // Research signals → medium complexity (Gemini)
    let research_keywords = [
        "explain", "compare", "what is", "how does", "analyze", "research",
        "find", "search", "alternative", "competitor", "trend", "review",
        "summarize", "pros and cons", "difference between",
    ];
    for kw in research_keywords {
        if query.contains(kw) {
            score = score.saturating_add(2);
        }
    }

    // Code context signals → bump to Claude
    if query.contains("```") || query.contains("fn ") || query.contains("function ")
        || query.contains("class ") || query.contains("import ")
    {
        score = score.saturating_add(4);
    }

    // Long query → likely complex
    let word_count = query.split_whitespace().count();
    if word_count > 50 {
        score = score.saturating_add(2);
    } else if word_count < 10 {
        // Short → likely simple, keep score low
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
