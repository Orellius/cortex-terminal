import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

type PermissionMode = "safe" | "ask" | "auto" | "bypass";

interface ModeConfig {
  label: string;
  color: string;
  description: string;
  detail: string;
}

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
  permission_mode: string;
}

const MODES: Record<PermissionMode, ModeConfig> = {
  safe: {
    label: "Safe", color: "#10b981", description: "Approve everything",
    detail: "All file writes, shell commands, and destructive actions require explicit approval. Recommended for untrusted models or sensitive projects.",
  },
  ask: {
    label: "Ask", color: "#f59e0b", description: "Ask for dangerous operations",
    detail: "Read-only operations run automatically. File writes, installs, and shell commands prompt for approval. Good balance of speed and safety.",
  },
  auto: {
    label: "Auto", color: "#8b5cf6", description: "Full autonomy",
    detail: "All operations execute without approval. Models can read, write, and run commands freely. Use with trusted models on non-critical projects.",
  },
  bypass: {
    label: "Bypass", color: "#f43f5e", description: "No restrictions",
    detail: "Disables all safety checks including verification gate and budget limits. Intended for debugging only.",
  },
};

const MODE_ORDER: PermissionMode[] = ["safe", "ask", "auto", "bypass"];
const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function PermissionsTab(): JSX.Element {
  const [activeMode, setActiveMode] = useState<PermissionMode>("ask");
  const [showBypassWarning, setShowBypassWarning] = useState(false);
  const [config, setConfig] = useState<CortexConfig | null>(null);

  useEffect(() => {
    invoke<CortexConfig>("get_ai_config").then((cfg) => {
      setConfig(cfg);
      const mode = cfg.permission_mode as PermissionMode;
      if (MODE_ORDER.includes(mode)) setActiveMode(mode);
    }).catch(() => {});
  }, []);

  const saveMode = useCallback((mode: PermissionMode) => {
    setActiveMode(mode);
    if (config) {
      const updated = { ...config, permission_mode: mode };
      invoke("update_ai_config", { newConfig: updated }).catch(() => {});
      setConfig(updated);
    }
  }, [config]);

  const handleSelect = useCallback((mode: PermissionMode) => {
    if (mode === "bypass") { setShowBypassWarning(true); return; }
    saveMode(mode);
    setShowBypassWarning(false);
  }, [saveMode]);

  const confirmBypass = useCallback(() => {
    saveMode("bypass");
    setShowBypassWarning(false);
  }, [saveMode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>Permission Mode</div>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginTop: "0.25rem" }}>
          Controls what AI models can do without asking. Applies to all providers. Saved to ~/.cortex/config.toml
        </div>
      </div>

      {MODE_ORDER.map((modeKey) => {
        const mode = MODES[modeKey];
        const isActive = activeMode === modeKey;
        return (
          <button key={modeKey} onClick={() => handleSelect(modeKey)} style={{
            padding: "0.875rem",
            border: isActive ? `1px solid ${mode.color}40` : "1px solid rgba(255,255,255,0.06)",
            borderRadius: "0.375rem",
            background: isActive ? `${mode.color}08` : "rgba(255,255,255,0.02)",
            display: "flex", flexDirection: "column", gap: "0.375rem",
            cursor: "pointer", textAlign: "left", transition: "border-color 150ms, background 150ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: isActive ? mode.color : "#a1a1aa", fontWeight: 600, ...MONO, fontSize: "0.75rem" }}>{mode.label}</span>
              <span style={{ ...MONO, fontSize: "0.625rem", color: "#52525b" }}>{mode.description}</span>
              {isActive && (
                <span style={{ marginLeft: "auto", ...MONO, fontSize: "0.5625rem", color: mode.color, background: `${mode.color}15`, padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>active</span>
              )}
            </div>
            <div style={{ ...MONO, fontSize: "0.625rem", color: "#3f3f46", paddingLeft: "0.25rem", lineHeight: 1.5 }}>{mode.detail}</div>
          </button>
        );
      })}

      {showBypassWarning && (
        <div style={{ padding: "0.875rem", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "0.375rem", background: "rgba(244,63,94,0.05)", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div style={{ ...MONO, fontSize: "0.75rem", color: "#f43f5e", fontWeight: 600 }}>Enable Bypass Mode?</div>
          <div style={{ ...MONO, fontSize: "0.625rem", color: "#a1a1aa", lineHeight: 1.6 }}>
            This disables all safety checks. Models can execute any command without approval, skip verification, and ignore budget limits.
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={confirmBypass} style={{ ...MONO, fontSize: "0.6875rem", fontWeight: 600, background: "#f43f5e", color: "#fff", border: "none", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}>Enable Bypass</button>
            <button onClick={() => setShowBypassWarning(false)} style={{ ...MONO, fontSize: "0.6875rem", background: "transparent", color: "#71717a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
