import { useState, useEffect, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeUsage } from "../types";

interface ProviderStatus {
  name: string;
  kind: string;
  available: boolean;
  model: string;
}

interface BudgetStatus {
  spent_today: number;
  limit: number;
  is_capped: boolean;
}

interface StatusBarProps {
  branch: string;
  usage: ClaudeUsage;
  onOpenLauncher: () => void;
  onOpenSettings: () => void;
}

function usageColor(pct: number): string {
  if (pct >= 80) return "#f43f5e";
  if (pct >= 50) return "#f59e0b";
  return "#52525b";
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#8b5cf6",
  gemini: "#0ea5e9",
  ollama: "#10b981",
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

const BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.1875rem 0.5rem",
  borderRadius: "0.25rem",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  background: "transparent",
  color: "#52525b",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.6875rem",
  cursor: "pointer",
  lineHeight: 1,
  transition: "color 100ms, border-color 100ms, background 100ms",
  whiteSpace: "nowrap",
};

const KBD: React.CSSProperties = {
  fontSize: "0.625rem",
  color: "#3f3f46",
};

export function StatusBar({
  branch,
  usage,
  onOpenLauncher,
  onOpenSettings,
}: StatusBarProps): JSX.Element {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [budget, setBudget] = useState<BudgetStatus>({ spent_today: 0, limit: 5, is_capped: false });

  useEffect(() => {
    const check = () => {
      invoke<ProviderStatus[]>("check_providers").then(setProviders).catch(() => {});
      invoke<BudgetStatus>("get_budget_status").then(setBudget).catch(() => {});
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const costStr = budget.spent_today > 0 ? `$${budget.spent_today.toFixed(3)}` : "$0";

  return (
    <div
      style={{
        height: "2.25rem",
        minHeight: "2.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0 0.75rem",
        borderTop: "none",
        background: "transparent",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.75rem",
        color: "#3f3f46",
        userSelect: "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Left: branch */}
      <span style={{ color: "#52525b" }}>
        {branch !== "—" ? branch : ""}
      </span>

      {/* Action buttons */}
      <button onClick={onOpenLauncher} style={BTN} title="Project Launcher (Cmd+K)">
        Projects <span style={KBD}>&#8984;K</span>
      </button>

      <button onClick={onOpenSettings} style={BTN} title="Settings (Cmd+,)">
        Settings <span style={KBD}>&#8984;,</span>
      </button>

      {/* Model status indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {providers.map((p) => (
          <span
            key={p.kind}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              color: p.available
                ? PROVIDER_COLORS[p.kind] ?? "#52525b"
                : "#27272a",
              opacity: p.available ? 1 : 0.4,
            }}
            title={`${p.name}: ${p.available ? p.model : "offline"}`}
          >
            {PROVIDER_ICONS[p.kind] ?? "○"}
            <span style={{ fontSize: "0.6875rem" }}>{p.name}</span>
          </span>
        ))}
      </div>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Budget */}
      <span style={{ color: budget.is_capped ? "#f43f5e" : "#3f3f46" }}>
        {costStr}
        {budget.is_capped && " LOCAL ONLY"}
      </span>

      {/* Usage */}
      <span>
        session{" "}
        <span style={{ color: usageColor(usage.session_pct) }}>
          {Math.round(usage.session_pct)}%
        </span>
      </span>
      <span>
        weekly{" "}
        <span style={{ color: usageColor(usage.weekly_pct) }}>
          {Math.round(usage.weekly_pct)}%
        </span>
      </span>
    </div>
  );
}
