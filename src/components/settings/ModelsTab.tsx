import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface OllamaModel {
  name: string;
  size: string;
  modified_at: string;
}

interface DetectedCli {
  name: string;
  path: string;
  version: string;
  available: boolean;
}

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
}

interface ModelsTabProps {
  config: CortexConfig;
  onSave: (config: CortexConfig) => Promise<void>;
  saving: boolean;
}

type RoleKey =
  | "coding"
  | "debugging"
  | "research"
  | "reasoning"
  | "writing"
  | "quick"
  | "security"
  | "data";

interface RoleConfig {
  label: string;
  icon: string;
  color: string;
  description: string;
  defaultProvider: "claude" | "gemini" | "ollama";
}

const ROLES: Record<RoleKey, RoleConfig> = {
  coding: {
    label: "Code Generation",
    icon: "◆",
    color: "#8b5cf6",
    description: "Write code, implement features, create files, scaffold projects",
    defaultProvider: "claude",
  },
  debugging: {
    label: "Debugging",
    icon: "◆",
    color: "#f43f5e",
    description: "Fix bugs, trace errors, diagnose crashes, resolve build issues",
    defaultProvider: "claude",
  },
  research: {
    label: "Research",
    icon: "◈",
    color: "#0ea5e9",
    description: "Explain concepts, compare alternatives, analyze trends",
    defaultProvider: "gemini",
  },
  reasoning: {
    label: "Reasoning",
    icon: "●",
    color: "#10b981",
    description: "Complex thinking, multi-step logic, architectural decisions",
    defaultProvider: "ollama",
  },
  writing: {
    label: "Writing",
    icon: "◈",
    color: "#f59e0b",
    description: "Docs, READMEs, commit messages, PR descriptions, copywriting",
    defaultProvider: "gemini",
  },
  quick: {
    label: "Quick Tasks",
    icon: "●",
    color: "#71717a",
    description: "Formatting, renaming, simple lookups, greetings, trivial queries",
    defaultProvider: "ollama",
  },
  security: {
    label: "Security",
    icon: "◆",
    color: "#ef4444",
    description: "Audit code, find vulnerabilities, review auth logic, pen-test",
    defaultProvider: "claude",
  },
  data: {
    label: "Data & Analysis",
    icon: "◈",
    color: "#06b6d4",
    description: "SQL queries, data transforms, CSV analysis, schema design",
    defaultProvider: "gemini",
  },
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontFamily: '"Geist Mono", Menlo, monospace',
  color: "#71717a",
  fontWeight: 500,
};

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.5rem",
  color: "#e4e4e7",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.6875rem",
  outline: "none",
  width: "100%",
  appearance: "none" as const,
  cursor: "pointer",
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
};

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_STYLE,
  background: "transparent",
  color: "#a1a1aa",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  fontWeight: 400,
};

export function ModelsTab({ config, onSave, saving }: ModelsTabProps): JSX.Element {
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [clis, setClis] = useState<DetectedCli[]>([]);
  const [scanning, setScanning] = useState(false);

  // Per-role model assignments
  const defaultAssignments: Record<RoleKey, string> = {
    coding: config.claude_model,
    debugging: config.claude_model,
    research: config.gemini_model,
    reasoning: config.ollama_model,
    writing: config.gemini_model,
    quick: config.ollama_model,
    security: config.claude_model,
    data: config.gemini_model,
  };
  const [assignments, setAssignments] = useState<Record<RoleKey, string>>(defaultAssignments);

  const setRoleModel = useCallback((role: RoleKey, model: string) => {
    setAssignments((prev) => ({ ...prev, [role]: model }));
  }, []);

  useEffect(() => {
    scanAll();
  }, []);

  const scanAll = useCallback(async () => {
    setScanning(true);
    try {
      const [models, detected] = await Promise.all([
        invoke<OllamaModel[]>("list_ollama_models").catch(() => []),
        invoke<DetectedCli[]>("scan_ai_clis").catch(() => []),
      ]);
      setOllamaModels(models);
      setClis(detected);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSave = useCallback(() => {
    // Derive the main config from the primary role assignments
    onSave({
      ...config,
      claude_model: assignments.coding,
      gemini_model: assignments.research,
      ollama_model: assignments.reasoning,
    });
    // TODO: persist per-role assignments to settings table when routing supports it
  }, [config, assignments, onSave]);

  // Auto-optimize: assign best model per role based on available models
  const autoOptimize = useCallback(() => {
    const claudeAvailable = clis.find((c) => c.name === "claude")?.available;
    const bestClaude = claudeAvailable ? "sonnet" : "";
    const bestGemini = config.gemini_api_key ? "gemini-2.0-flash" : "";

    // Find best local models
    const cascadeModel = ollamaModels.find((m) => m.name.includes("cascade"));
    const nanoModel = ollamaModels.find((m) => m.name.includes("nemotron-3-nano") && m.name.includes("30b"));
    const nano4b = ollamaModels.find((m) => m.name.includes("nemotron-3-nano") && m.name.includes("4b"));
    const bestLocal = cascadeModel?.name ?? nanoModel?.name ?? ollamaModels[0]?.name ?? "nemotron-cascade-2";
    const bestFast = nano4b?.name ?? bestLocal;

    setAssignments({
      coding: bestClaude || bestLocal,
      debugging: bestClaude || bestLocal,
      research: bestGemini || bestLocal,
      reasoning: bestLocal,
      writing: bestGemini || bestLocal,
      quick: bestFast,
      security: bestClaude || bestLocal,
      data: bestGemini || bestLocal,
    });
  }, [clis, ollamaModels, config.gemini_api_key]);

  // Build combined model options for dropdowns
  const allModels: string[] = [
    ...["sonnet", "opus", "haiku"],
    ...["gemini-2.0-flash"],
    ...ollamaModels.map((m) => m.name),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Scan + auto-optimize bar */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button style={BTN_SECONDARY} onClick={scanAll} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan"}
        </button>
        <button style={BTN_STYLE} onClick={autoOptimize}>
          Auto-optimize
        </button>
        <span style={{ ...LABEL_STYLE, marginLeft: "auto" }}>
          {ollamaModels.length} local models
        </span>
      </div>

      {/* Role cards */}
      {(Object.keys(ROLES) as RoleKey[]).map((roleKey) => {
        const role = ROLES[roleKey];
        return (
          <div
            key={roleKey}
            style={{
              padding: "0.75rem",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "0.375rem",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ color: role.color, fontSize: "0.75rem" }}>{role.icon}</span>
              <span
                style={{
                  color: role.color,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  fontFamily: '"Geist Mono", Menlo, monospace',
                }}
              >
                {role.label}
              </span>
            </div>
            <div
              style={{
                fontSize: "0.625rem",
                fontFamily: '"Geist Mono", Menlo, monospace',
                color: "#52525b",
              }}
            >
              {role.description}
            </div>
            <select
              style={SELECT_STYLE}
              value={assignments[roleKey]}
              onChange={(e) => setRoleModel(roleKey, e.target.value)}
            >
              {allModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                  {ollamaModels.find((om) => om.name === m)
                    ? ` (${ollamaModels.find((om) => om.name === m)?.size})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      {/* Detected CLIs */}
      <div
        style={{
          padding: "0.75rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.375rem",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ ...LABEL_STYLE, marginBottom: "0.5rem" }}>Detected CLIs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {clis.map((cli) => (
            <div
              key={cli.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.6875rem",
                fontFamily: '"Geist Mono", Menlo, monospace',
              }}
            >
              <span
                style={{
                  width: "0.5rem",
                  height: "0.5rem",
                  borderRadius: "50%",
                  background: cli.available ? "#10b981" : "#3f3f46",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: cli.available ? "#e4e4e7" : "#52525b", width: "4rem" }}>
                {cli.name}
              </span>
              <span style={{ color: "#52525b", flex: 1 }}>
                {cli.available ? cli.version : "not found"}
              </span>
              {cli.path && (
                <span style={{ color: "#3f3f46", fontSize: "0.625rem" }}>{cli.path}</span>
              )}
            </div>
          ))}
          {clis.length === 0 && !scanning && (
            <span style={{ color: "#3f3f46", fontSize: "0.625rem" }}>
              Click Scan to detect available CLIs
            </span>
          )}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          style={{ ...BTN_STYLE, opacity: saving ? 0.5 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
