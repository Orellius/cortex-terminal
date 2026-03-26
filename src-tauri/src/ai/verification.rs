/// Verification gate — catches hallucinations, garbage, and AI-speak.
/// Ported from Golem. Every AI response passes through this before display.

#[derive(Debug, Clone)]
pub(crate) struct VerifyResult {
    pub passed: bool,
    pub score: u8,
    pub flags: Vec<String>,
}

pub(crate) fn verify(output: &str, query: &str) -> VerifyResult {
    let mut flags = Vec::new();
    let mut score: u8 = 100;
    let trimmed = output.trim();

    if trimmed.is_empty() {
        return VerifyResult { passed: false, score: 0, flags: vec!["empty".into()] };
    }

    if trimmed.len() < 15 {
        flags.push("too_short".into());
        score = score.saturating_sub(40);
    }

    // Garbage detection
    let garbage = trimmed.chars()
        .filter(|c| !c.is_ascii() && !c.is_alphanumeric() && *c != '\n')
        .count() as f64 / trimmed.len().max(1) as f64;
    if garbage > 0.3 {
        flags.push("garbage".into());
        score = score.saturating_sub(60);
    }

    // Hallucination signals
    let lower = trimmed.to_lowercase();
    for phrase in [
        "i'm not sure", "i think maybe", "i don't have access",
        "as an ai", "as a language model", "i cannot",
    ] {
        if lower.contains(phrase) {
            flags.push(format!("hedging: {phrase}"));
            score = score.saturating_sub(15);
        }
    }

    // AI-speak detection
    let mut ai_count = 0u8;
    for word in [
        "streamline", "leverage", "utilize", "facilitate", "delve",
        "cutting-edge", "game-changer", "revolutionary",
    ] {
        if lower.contains(word) { ai_count += 1; }
    }
    if ai_count >= 3 {
        flags.push(format!("ai_speak: {ai_count}"));
        score = score.saturating_sub(20);
    }

    // Relevance — query keywords should appear in output
    let query_lower = query.to_lowercase();
    let keywords: Vec<&str> = query_lower.split_whitespace()
        .filter(|w| w.len() > 3)
        .collect();
    if !keywords.is_empty() {
        let found = keywords.iter().filter(|w| lower.contains(**w)).count();
        if found == 0 {
            flags.push("off_topic".into());
            score = score.saturating_sub(25);
        }
    }

    let passed = score >= 40 && !flags.contains(&"garbage".to_string());
    VerifyResult { passed, score, flags }
}
