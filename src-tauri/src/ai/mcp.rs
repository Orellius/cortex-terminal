//! MCP Bridge — spawn MCP servers, discover tools, bridge to all models.
//!
//! Each MCP server runs as a child process communicating via JSON-RPC over stdio.
//! On startup, we send `initialize` + `tools/list` to discover available tools.
//! Tool descriptions are injected into model system prompts so all models can
//! request tool calls.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::config::{self, McpServerEntry};

/// A discovered MCP tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct McpTool {
    pub name: String,
    pub description: String,
    pub server: String,
}

/// Running MCP server process
struct McpProcess {
    child: Child,
    tools: Vec<McpTool>,
}

/// Manages all MCP server processes and their tools
pub(crate) struct McpBridge {
    processes: HashMap<String, McpProcess>,
}

impl McpBridge {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }

    /// Start all enabled MCP servers from config and discover their tools
    pub fn start_all(&mut self) -> Result<()> {
        let mcp_config = config::load_mcp_config()?;
        for server in &mcp_config.servers {
            if !server.enabled {
                continue;
            }
            match self.start_server(server) {
                Ok(tools) => {
                    log::info!("MCP server '{}' started — {} tools", server.name, tools.len());
                }
                Err(e) => {
                    log::warn!("MCP server '{}' failed to start: {e}", server.name);
                }
            }
        }
        Ok(())
    }

    /// Start a single MCP server and discover its tools
    fn start_server(&mut self, entry: &McpServerEntry) -> Result<Vec<McpTool>> {
        let mut child = Command::new(&entry.command)
            .args(&entry.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .with_context(|| format!("failed to spawn MCP server '{}'", entry.name))?;

        // Send initialize request
        let init_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "cortex", "version": "2.0.0" }
            }
        });
        send_jsonrpc(&mut child, &init_req)?;
        let _init_resp = read_jsonrpc(&mut child)?;

        // Send initialized notification
        let initialized = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        send_jsonrpc(&mut child, &initialized)?;

        // Request tools list
        let tools_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        });
        send_jsonrpc(&mut child, &tools_req)?;
        let tools_resp = read_jsonrpc(&mut child)?;

        // Parse tools from response
        let tools = parse_tools(&entry.name, &tools_resp);

        self.processes.insert(
            entry.name.clone(),
            McpProcess {
                child,
                tools: tools.clone(),
            },
        );

        Ok(tools)
    }

    /// Call a tool on a specific MCP server
    pub fn call_tool(&mut self, server_name: &str, tool_name: &str, args: &serde_json::Value) -> Result<String> {
        let process = self.processes.get_mut(server_name)
            .ok_or_else(|| anyhow::anyhow!("MCP server '{}' not running", server_name))?;

        let call_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            }
        });
        send_jsonrpc(&mut process.child, &call_req)?;
        let resp = read_jsonrpc(&mut process.child)?;

        // Extract content from response
        if let Some(content) = resp["result"]["content"].as_array() {
            let texts: Vec<&str> = content
                .iter()
                .filter_map(|c| c["text"].as_str())
                .collect();
            Ok(texts.join("\n"))
        } else if let Some(err) = resp["error"]["message"].as_str() {
            anyhow::bail!("MCP tool error: {err}")
        } else {
            Ok(format!("{}", resp))
        }
    }

    /// Get all discovered tools across all running servers
    pub fn all_tools(&self) -> Vec<McpTool> {
        self.processes
            .values()
            .flat_map(|p| p.tools.clone())
            .collect()
    }

    /// Build a text block describing all available tools for injection into prompts
    pub fn tools_prompt_block(&self) -> String {
        let tools = self.all_tools();
        if tools.is_empty() {
            return String::new();
        }

        let mut block = String::from("Available MCP tools:\n");
        for tool in &tools {
            block.push_str(&format!("- {} (server: {}): {}\n", tool.name, tool.server, tool.description));
        }
        block
    }

    /// Stop all MCP servers
    pub fn stop_all(&mut self) {
        for (name, mut proc) in self.processes.drain() {
            let _ = proc.child.kill();
            log::info!("MCP server '{}' stopped", name);
        }
    }

    /// Get names of running servers
    pub fn running_servers(&self) -> Vec<String> {
        self.processes.keys().cloned().collect()
    }
}

impl Drop for McpBridge {
    fn drop(&mut self) {
        self.stop_all();
    }
}

/// Thread-safe wrapper
pub(crate) type McpBridgeState = Arc<Mutex<McpBridge>>;

// ─── JSON-RPC Helpers ───────────────────────────────────────

fn send_jsonrpc(child: &mut Child, msg: &serde_json::Value) -> Result<()> {
    let stdin = child.stdin.as_mut().context("no stdin")?;
    let body = serde_json::to_string(msg)?;
    let header = format!("Content-Length: {}\r\n\r\n", body.len());
    stdin.write_all(header.as_bytes())?;
    stdin.write_all(body.as_bytes())?;
    stdin.flush()?;
    Ok(())
}

fn read_jsonrpc(child: &mut Child) -> Result<serde_json::Value> {
    let stdout = child.stdout.as_mut().context("no stdout")?;
    let mut reader = BufReader::new(stdout);

    // Read headers until empty line
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            break;
        }
        if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
            content_length = len_str.parse().unwrap_or(0);
        }
    }

    if content_length == 0 {
        anyhow::bail!("no content-length in MCP response");
    }

    // Read body
    let mut body = vec![0u8; content_length];
    std::io::Read::read_exact(&mut reader, &mut body)?;
    let parsed: serde_json::Value = serde_json::from_slice(&body)?;
    Ok(parsed)
}

fn parse_tools(server_name: &str, resp: &serde_json::Value) -> Vec<McpTool> {
    resp["result"]["tools"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let name = t["name"].as_str()?.to_string();
                    let description = t["description"].as_str().unwrap_or("").to_string();
                    Some(McpTool {
                        name,
                        description,
                        server: server_name.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}
