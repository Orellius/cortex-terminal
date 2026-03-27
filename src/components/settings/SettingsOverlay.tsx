import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProvidersTab } from "./ProvidersTab";
import { ModelsTab } from "./ModelsTab";
import { BudgetTab } from "./BudgetTab";

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
}

type SettingsTab = "models" | "providers" | "routing" | "budget";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "providers", label: "Providers" },
  { id: "routing", label: "Routing" },
  { id: "budget", label: "Budget" },
];

interface SettingsOverlayProps {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [config, setConfig] = useState<CortexConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    invoke<CortexConfig>("get_ai_config")
      .then(setConfig)
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async (updated: CortexConfig) => {
    setSaving(true);
    setSaveMsg("");
    try {
      await invoke("update_ai_config", { newConfig: updated });
      setConfig(updated);
      setSaveMsg("saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveMsg(`error: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(36rem, 90vw)",
          maxHeight: "80vh",
          background: "#0d0d0d",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "0.5rem",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: '"Geist Sans", -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span
            style={{
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#e4e4e7",
            }}
          >
            Settings
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {saveMsg && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: saveMsg === "saved" ? "#10b981" : "#f43f5e",
                  fontFamily: '"Geist Mono", Menlo, monospace',
                }}
              >
                {saveMsg}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#52525b",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "0.25rem",
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            padding: "0.25rem 0.5rem",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "0.375rem 0.625rem",
                background: activeTab === tab.id
                  ? "rgba(255, 255, 255, 0.06)"
                  : "transparent",
                border: "none",
                borderRadius: "0.375rem",
                color: activeTab === tab.id ? "#e4e4e7" : "#52525b",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.6875rem",
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: "pointer",
                transition: "color 100ms, background 100ms",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "1rem",
          }}
        >
          {config === null ? (
            <div style={{ color: "#52525b", fontSize: "0.75rem" }}>Loading...</div>
          ) : activeTab === "models" ? (
            <ModelsTab config={config} onSave={handleSave} saving={saving} />
          ) : activeTab === "providers" ? (
            <ProvidersTab config={config} onSave={handleSave} saving={saving} />
          ) : activeTab === "routing" ? (
            <RoutingInfo />
          ) : (
            <BudgetTab config={config} onSave={handleSave} saving={saving} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Static routing rules display — scoring is deterministic, not configurable */
function RoutingInfo(): JSX.Element {
  const tiers = [
    {
      icon: "◆",
      name: "Claude",
      color: "#8b5cf6",
      threshold: "Score 5+",
      signals: [
        "Code actions: fix, build, debug, refactor, deploy, implement, optimize",
        "Code context: bug, error, function, component, api, test",
        "Code syntax: fn, function, class, import, async, struct",
        "File extensions: .rs, .ts, .tsx, .js, .py, .toml",
      ],
    },
    {
      icon: "◈",
      name: "Gemini",
      color: "#0ea5e9",
      threshold: "Score 3-4",
      signals: [
        "Research words: explain, compare, analyze, research, summarize",
        "Question phrases: what is, how does, how to, pros and cons",
      ],
    },
    {
      icon: "●",
      name: "Local (Ollama)",
      color: "#10b981",
      threshold: "Score 0-2",
      signals: [
        "Short queries, greetings, simple questions",
        "Default fallback when no signals match",
      ],
    },
  ];

  const fieldStyle = {
    fontSize: "0.6875rem",
    fontFamily: '"Geist Mono", Menlo, monospace' as const,
    color: "#a1a1aa",
    lineHeight: 1.6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ ...fieldStyle, color: "#71717a", marginBottom: "0.25rem" }}>
        Queries are scored 0-10 based on word signals, then routed to the highest-matching tier.
        Force a model with prefixes: <span style={{ color: "#a1a1aa" }}>c:</span> Claude,{" "}
        <span style={{ color: "#a1a1aa" }}>g:</span> Gemini,{" "}
        <span style={{ color: "#a1a1aa" }}>l:</span> Local
      </div>
      {tiers.map((tier) => (
        <div
          key={tier.name}
          style={{
            padding: "0.75rem",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "0.375rem",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <span style={{ color: tier.color, fontSize: "0.75rem" }}>{tier.icon}</span>
            <span style={{ color: tier.color, fontWeight: 600, fontSize: "0.75rem", fontFamily: '"Geist Mono", Menlo, monospace' }}>
              {tier.name}
            </span>
            <span style={{ ...fieldStyle, color: "#52525b", marginLeft: "auto" }}>{tier.threshold}</span>
          </div>
          {tier.signals.map((signal, i) => (
            <div key={i} style={{ ...fieldStyle, color: "#52525b", paddingLeft: "1.25rem" }}>
              {signal}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
