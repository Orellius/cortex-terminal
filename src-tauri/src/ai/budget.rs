use std::sync::Arc;

use anyhow::Result;

use super::database::Database;
use super::types::BudgetStatus;

/// Check if we should block cloud providers due to budget cap.
pub(crate) fn check_budget(db: &Arc<Database>, daily_limit: f64) -> Result<BudgetStatus> {
    db.get_budget_status(daily_limit)
}

/// Returns true if cloud providers should be blocked.
pub(crate) fn is_capped(db: &Arc<Database>, daily_limit: f64) -> bool {
    db.get_budget_status(daily_limit)
        .map(|s| s.is_capped)
        .unwrap_or(false)
}
