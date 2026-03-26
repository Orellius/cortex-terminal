use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::Connection;

use super::types::{BudgetStatus, CortexConfig, CostEntry};

pub(crate) struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub(crate) fn init(data_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(data_dir)
            .with_context(|| format!("cannot create data dir: {}", data_dir.display()))?;

        let conn = Connection::open(data_dir.join("cortex.db"))
            .context("cannot open cortex.db")?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .context("failed to set PRAGMA")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cost_log (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                cost_usd REAL NOT NULL DEFAULT 0.0,
                query_preview TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cost_date ON cost_log(created_at);"
        ).context("migration failed")?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub(crate) fn log_cost(&self, entry: &CostEntry) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO cost_log (id, provider, model, cost_usd, query_preview, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, entry.provider, entry.model, entry.cost_usd, entry.query_preview, entry.created_at],
        ).context("failed to log cost")?;
        Ok(())
    }

    pub(crate) fn get_budget_status(&self, daily_limit: f64) -> Result<BudgetStatus> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let pattern = format!("{today}%");

        let spent: f64 = conn.query_row(
            "SELECT COALESCE(SUM(cost_usd), 0.0) FROM cost_log WHERE created_at LIKE ?1",
            rusqlite::params![pattern],
            |row| row.get(0),
        ).unwrap_or(0.0);

        Ok(BudgetStatus {
            spent_today: spent,
            limit: daily_limit,
            is_capped: spent >= daily_limit,
        })
    }

    pub(crate) fn get_setting(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().ok()?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get(0),
        ).ok()
    }

    pub(crate) fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        ).context("failed to set setting")?;
        Ok(())
    }
}
