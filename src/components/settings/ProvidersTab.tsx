import { useState, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
}

interface ProviderStatus {
  name: string;
  kind: string;
  available: boolean;
  model: string;
}

interface ProvidersTabProps {
  config: CortexConfig;
  onSave: (config: CortexConfig) => Promise<void>;
  saving: boolean;
}

const FIELD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontFamily: '"Geist Mono", Menlo, monospace',
  color: "#71717a",
  fontWeight: 500,
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.625rem",
  color: "#e4e4e7",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.75rem",
  outline: "none",
  width: "100%",
};

const BTN_STYLE: React.CSSProperties = {
  background: "#e4e4e7",
  color: "#09090b",
  border: "none",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.75rem",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.6875rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 100ms",
};

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_STYLE,
  background: "transparent",
  color: "#a1a1aa",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  fontWeight: 400,
};

export function ProvidersTab({ config, onSave, saving }: ProvidersTabProps): JSX.Element {
  const [claudeModel, setClaudeModel] = useState(config.claude_model);
  const [geminiModel, setGeminiModel] = useState(config.gemini_model);
  const [geminiKey, setGeminiKey] = useState(config.gemini_api_key ?? "");
  const [ollamaModel, setOllamaModel] = useState(config.ollama_model);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(config.ollama_endpoint);
  const [testResults, setTestResults] = useState<Record<string, string | null>>({});

  const handleSave = useCallback(() => {
    onSave({
      ...config,
      claude_model: claudeModel,
      gemini_model: geminiModel,
      gemini_api_key: geminiKey.trim() || null,
      ollama_model: ollamaModel,
      ollama_endpoint: ollamaEndpoint,
    });
  }, [config, claudeModel, geminiModel, geminiKey, ollamaModel, ollamaEndpoint, onSave]);

  const testConnection = useCallback(async (kind: string) => {
    setTestResults((prev) => ({ ...prev, [kind]: "testing..." }));
    try {
      const statuses = await invoke<ProviderStatus[]>("check_providers");
      const status = statuses.find((s) => s.kind === kind);
      setTestResults((prev) => ({
        ...prev,
        [kind]: status?.available ? "connected" : "offline",
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [kind]: "error" }));
    }
  }, []);

  const statusColor = (result: string | null | undefined): string => {
    if (!result) return "#52525b";
    if (result === "connected") return "#10b981";
    if (result === "testing...") return "#f59e0b";
    return "#f43f5e";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Claude */}
      <ProviderSection
        icon="◆"
        name="Claude"
        color="#8b5cf6"
        description="Code execution via Claude CLI. Install: npm i -g @anthropic-ai/claude-code"
      >
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>Model</label>
          <input
            style={INPUT_STYLE}
            value={claudeModel}
            onChange={(e) => setClaudeModel(e.target.value)}
            placeholder="sonnet"
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button style={BTN_SECONDARY} onClick={() => testConnection("claude")}>
            Test
          </button>
          {testResults.claude && (
            <span style={{ fontSize: "0.6875rem", fontFamily: '"Geist Mono", Menlo, monospace', color: statusColor(testResults.claude) }}>
              {testResults.claude}
            </span>
          )}
        </div>
      </ProviderSection>

      {/* Gemini */}
      <ProviderSection
        icon="◈"
        name="Gemini"
        color="#0ea5e9"
        description="Research via Gemini API. Free tier: 15 RPM"
      >
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>Model</label>
          <input
            style={INPUT_STYLE}
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            placeholder="gemini-2.0-flash"
          />
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>API Key</label>
          <input
            style={INPUT_STYLE}
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button style={BTN_SECONDARY} onClick={() => testConnection("gemini")}>
            Test
          </button>
          {testResults.gemini && (
            <span style={{ fontSize: "0.6875rem", fontFamily: '"Geist Mono", Menlo, monospace', color: statusColor(testResults.gemini) }}>
              {testResults.gemini}
            </span>
          )}
        </div>
      </ProviderSection>

      {/* Ollama */}
      <ProviderSection
        icon="●"
        name="Local (Ollama)"
        color="#10b981"
        description="Free local models via Ollama. Install: ollama.com"
      >
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>Model</label>
          <input
            style={INPUT_STYLE}
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="nemotron-cascade-2"
          />
        </div>
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>Endpoint</label>
          <input
            style={INPUT_STYLE}
            value={ollamaEndpoint}
            onChange={(e) => setOllamaEndpoint(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button style={BTN_SECONDARY} onClick={() => testConnection("ollama")}>
            Test
          </button>
          {testResults.ollama && (
            <span style={{ fontSize: "0.6875rem", fontFamily: '"Geist Mono", Menlo, monospace', color: statusColor(testResults.ollama) }}>
              {testResults.ollama}
            </span>
          )}
        </div>
      </ProviderSection>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.25rem" }}>
        <button style={{ ...BTN_STYLE, opacity: saving ? 0.5 : 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

interface ProviderSectionProps {
  icon: string;
  name: string;
  color: string;
  description: string;
  children: React.ReactNode;
}

function ProviderSection({ icon, name, color, description, children }: ProviderSectionProps): JSX.Element {
  return (
    <div
      style={{
        padding: "0.75rem",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "0.375rem",
        background: "rgba(255, 255, 255, 0.02)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.125rem" }}>
          <span style={{ color, fontSize: "0.75rem" }}>{icon}</span>
          <span style={{ color, fontWeight: 600, fontSize: "0.75rem", fontFamily: '"Geist Mono", Menlo, monospace' }}>
            {name}
          </span>
        </div>
        <div style={{ fontSize: "0.625rem", color: "#52525b", fontFamily: '"Geist Mono", Menlo, monospace' }}>
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}
