import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface McpServer {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

const CARD: React.CSSProperties = {
  padding: "0.75rem", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.375rem", background: "rgba(255,255,255,0.02)",
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.375rem", padding: "0.4rem 0.5rem", color: "#e4e4e7",
  ...MONO, fontSize: "0.6875rem", outline: "none", width: "100%",
};

const BTN: React.CSSProperties = {
  ...MONO, fontSize: "0.6875rem", fontWeight: 600, background: "#e4e4e7",
  color: "#09090b", border: "none", borderRadius: "0.375rem",
  padding: "0.375rem 0.75rem", cursor: "pointer",
};

const BTN_SEC: React.CSSProperties = {
  ...BTN, background: "transparent", color: "#a1a1aa",
  border: "1px solid rgba(255,255,255,0.08)", fontWeight: 400,
};

export function McpTab(): JSX.Element {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Load from ~/.cortex/mcp.toml on mount
  useEffect(() => {
    invoke<McpServer[]>("get_mcp_servers").then(setServers).catch(() => {});
  }, []);

  // Persist to disk whenever servers change
  const persist = useCallback((updated: McpServer[]) => {
    setServers(updated);
    invoke("save_mcp_servers", { servers: updated }).catch(() => {});
  }, []);

  const toggleServer = useCallback((name: string) => {
    persist(servers.map((s) => (s.name === name ? { ...s, enabled: !s.enabled } : s)));
  }, [servers, persist]);

  const removeServer = useCallback((name: string) => {
    persist(servers.filter((s) => s.name !== name));
  }, [servers, persist]);

  const addServer = useCallback(() => {
    if (!newName.trim() || !newCommand.trim()) return;
    const server: McpServer = {
      name: newName.trim(), command: newCommand.trim(),
      args: newArgs.trim() ? newArgs.trim().split(/\s+/) : [], enabled: true,
    };
    persist([...servers, server]);
    setNewName(""); setNewCommand(""); setNewArgs(""); setShowAdd(false);
  }, [newName, newCommand, newArgs, servers, persist]);

  const importFromClaude = useCallback(async () => {
    setImporting(true); setImportMsg("");
    try {
      const imported = await invoke<McpServer[]>("import_mcp_from_claude_config");
      if (imported.length === 0) { setImportMsg("No MCP servers found in Claude config"); return; }
      const existing = new Set(servers.map((s) => s.name));
      const newServers = imported.filter((s) => !existing.has(s.name));
      if (newServers.length === 0) { setImportMsg("All servers already imported"); return; }
      persist([...servers, ...newServers]);
      setImportMsg(`Imported ${newServers.length} server${newServers.length > 1 ? "s" : ""}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportMsg(msg);
    } finally {
      setImporting(false);
      setTimeout(() => setImportMsg(""), 3000);
    }
  }, [servers, persist]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>MCP Servers</div>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginTop: "0.25rem" }}>
          Model Context Protocol servers shared across all AI models. Config: ~/.cortex/mcp.toml
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <button style={BTN_SEC} onClick={importFromClaude} disabled={importing}>
          {importing ? "Reading..." : "Import from Claude Code"}
        </button>
        <button style={BTN} onClick={() => setShowAdd(true)}>Add Server</button>
        {importMsg && <span style={{ ...MONO, fontSize: "0.5625rem", color: importMsg.includes("Imported") ? "#10b981" : "#f59e0b" }}>{importMsg}</span>}
      </div>

      {/* Server list */}
      {servers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {servers.map((server) => (
            <div key={server.name} style={{ ...CARD, display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button onClick={() => toggleServer(server.name)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem", color: server.enabled ? "#10b981" : "#3f3f46" }}>
                {server.enabled ? "●" : "○"}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ ...MONO, fontSize: "0.6875rem", color: server.enabled ? "#e4e4e7" : "#52525b", fontWeight: 500 }}>{server.name}</div>
                <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46" }}>{server.command} {server.args.join(" ")}</div>
              </div>
              <button onClick={() => removeServer(server.name)} style={{ ...MONO, fontSize: "0.625rem", color: "#3f3f46", background: "none", border: "none", cursor: "pointer" }}>x</button>
            </div>
          ))}
        </div>
      )}

      {servers.length === 0 && !showAdd && (
        <div style={{ ...CARD, textAlign: "center", padding: "2rem 1rem" }}>
          <div style={{ ...MONO, fontSize: "0.75rem", color: "#52525b", marginBottom: "0.5rem" }}>No MCP servers configured</div>
          <div style={{ ...MONO, fontSize: "0.625rem", color: "#3f3f46" }}>Add servers or import from Claude Code settings.json</div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500 }}>New MCP Server</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...MONO, fontSize: "0.5625rem", color: "#52525b", display: "block", marginBottom: "0.25rem" }}>Name</label>
              <input style={INPUT_STYLE} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-server" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...MONO, fontSize: "0.5625rem", color: "#52525b", display: "block", marginBottom: "0.25rem" }}>Command</label>
              <input style={INPUT_STYLE} value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="npx" />
            </div>
          </div>
          <div>
            <label style={{ ...MONO, fontSize: "0.5625rem", color: "#52525b", display: "block", marginBottom: "0.25rem" }}>Arguments (space-separated)</label>
            <input style={INPUT_STYLE} value={newArgs} onChange={(e) => setNewArgs(e.target.value)} placeholder="-y @scope/server-name" />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button style={BTN} onClick={addServer}>Add</button>
            <button style={BTN_SEC} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
