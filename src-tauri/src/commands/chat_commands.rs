use std::sync::Arc;

use tauri::State;

use crate::ai::database::{ConversationEntry, Database, MessageEntry};

fn to_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub(crate) async fn create_conversation(
    tab_id: String,
    db: State<'_, Arc<Database>>,
) -> Result<String, String> {
    db.create_conversation(&tab_id).map_err(to_err)
}

#[tauri::command]
pub(crate) async fn add_message(
    msg: MessageEntry,
    db: State<'_, Arc<Database>>,
) -> Result<(), String> {
    db.add_message(&msg).map_err(to_err)
}

#[tauri::command]
pub(crate) async fn get_messages(
    conversation_id: String,
    db: State<'_, Arc<Database>>,
) -> Result<Vec<MessageEntry>, String> {
    db.get_messages(&conversation_id).map_err(to_err)
}

#[tauri::command]
pub(crate) async fn list_conversations(
    limit: Option<usize>,
    db: State<'_, Arc<Database>>,
) -> Result<Vec<ConversationEntry>, String> {
    db.list_conversations(limit.unwrap_or(50)).map_err(to_err)
}
