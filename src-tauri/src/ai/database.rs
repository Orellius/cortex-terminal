use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::Connection;

use super::types::{BudgetStatus, CostEntry};

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

            CREATE INDEX IF NOT EXISTS idx_cost_date ON cost_log(created_at);

            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Chat',
                tab_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                provider TEXT,
                model TEXT,
                cost_usd REAL NOT NULL DEFAULT 0.0,
                duration_ms INTEGER NOT NULL DEFAULT 0,
                verified INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);"
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

    // ─── Conversation persistence ───────────────────────────────

    pub(crate) fn create_conversation(&self, tab_id: &str) -> Result<String> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO conversations (id, tab_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            rusqlite::params![id, tab_id, now],
        ).context("failed to create conversation")?;
        Ok(id)
    }

    pub(crate) fn add_message(&self, msg: &MessageEntry) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, provider, model, cost_usd, duration_ms, verified, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                msg.conversation_id,
                msg.role,
                msg.content,
                msg.provider,
                msg.model,
                msg.cost_usd,
                msg.duration_ms,
                msg.verified as i32,
                msg.created_at,
            ],
        ).context("failed to add message")?;

        // Update conversation title from first user message
        if msg.role == "user" {
            let title = truncate_str(&msg.content, 60);
            conn.execute(
                "UPDATE conversations SET title = ?1, updated_at = ?2
                 WHERE id = ?3 AND title = 'New Chat'",
                rusqlite::params![title, msg.created_at, msg.conversation_id],
            ).context("failed to update title")?;
        }

        conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![msg.created_at, msg.conversation_id],
        ).context("failed to touch conversation")?;

        Ok(())
    }

    pub(crate) fn get_messages(&self, conversation_id: &str) -> Result<Vec<MessageEntry>> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let mut stmt = conn.prepare(
            "SELECT conversation_id, role, content, provider, model, cost_usd, duration_ms, verified, created_at
             FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC"
        ).context("prepare failed")?;

        let rows = stmt.query_map(rusqlite::params![conversation_id], |row| {
            Ok(MessageEntry {
                conversation_id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                provider: row.get(3)?,
                model: row.get(4)?,
                cost_usd: row.get(5)?,
                duration_ms: row.get(6)?,
                verified: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
            })
        }).context("query failed")?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(row.context("row parse failed")?);
        }
        Ok(messages)
    }

    pub(crate) fn list_conversations(&self, limit: usize) -> Result<Vec<ConversationEntry>> {
        let conn = self.conn.lock().map_err(|_| anyhow::anyhow!("db mutex poisoned"))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, tab_id, created_at, updated_at
             FROM conversations ORDER BY updated_at DESC LIMIT ?1"
        ).context("prepare failed")?;

        let rows = stmt.query_map(rusqlite::params![limit as i64], |row| {
            Ok(ConversationEntry {
                id: row.get(0)?,
                title: row.get(1)?,
                tab_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        }).context("query failed")?;

        let mut convs = Vec::new();
        for row in rows {
            convs.push(row.context("row parse failed")?);
        }
        Ok(convs)
    }
}

fn truncate_str(s: &str, max: usize) -> String {
    if s.len() <= max { s.to_string() } else { format!("{}...", &s[..max]) }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub(crate) struct MessageEntry {
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub cost_usd: f64,
    pub duration_ms: u64,
    pub verified: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub(crate) struct ConversationEntry {
    pub id: String,
    pub title: String,
    pub tab_id: String,
    pub created_at: String,
    pub updated_at: String,
}
