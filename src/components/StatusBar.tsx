import { useState, useEffect, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeUsage } from "../types";
import { STATUS_BAR_HEIGHT } from "../constants";

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

export function StatusBar({
  branch,
  usage,
  onOpenLauncher,
}: StatusBarProps): JSX.Element {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [budget, setBudget] = useState<BudgetStatus>({ spent_today: 0, limit: 5, is_capped: false });
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Check providers on mount + every 30s
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
        height: STATUS_BAR_HEIGHT,
        minHeight: STATUS_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0 0.75rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        background: "#010101",
        position: "relative" as const,
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.6875rem",
        color: "#3f3f46",
        userSelect: "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Left: branch */}
      <span style={{ color: "#52525b" }}>
        {branch !== "—" ? branch : ""}
      </span>

      {/* Cmd+K hint */}
      <span
        onClick={onOpenLauncher}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.125rem 0.375rem",
          borderRadius: "0.25rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          color: "#52525b",
          fontSize: "0.6875rem",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: "0.625rem" }}>&#8984;</span>K
      </span>

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
            <span style={{ fontSize: "0.625rem" }}>{p.name}</span>
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
      {/* Routing info button */}
      <span
        onClick={() => setShowInfo(!showInfo)}
        style={{
          cursor: "pointer",
          color: showInfo ? "#71717a" : "#27272a",
          fontSize: "0.75rem",
          transition: "color 100ms",
        }}
        title="Model routing info"
      >
        ⓘ
      </span>

      {/* Routing info tooltip */}
      {showInfo && (
        <div
          style={{
            position: "absolute",
            bottom: STATUS_BAR_HEIGHT,
            right: "0.5rem",
            width: "22rem",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            background: "#0d0d0d",
            fontFamily: '"Geist Mono", Menlo, monospace',
            fontSize: "0.625rem",
            color: "#a1a1aa",
            lineHeight: 1.6,
            zIndex: 50,
          }}
        >
          <div style={{ fontWeight: 600, color: "#e4e4e7", marginBottom: "0.5rem", fontSize: "0.6875rem" }}>
            Model Routing
          </div>
          <div style={{ color: "#71717a", marginBottom: "0.5rem" }}>
            Queries are scored 0-10 based on keywords:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div>
              <span style={{ color: "#8b5cf6" }}>◆ Claude (7+)</span>
              <span style={{ color: "#52525b" }}> — implement, build, fix, debug, refactor, deploy, code syntax</span>
            </div>
            <div>
              <span style={{ color: "#0ea5e9" }}>◈ Gemini (4-6)</span>
              <span style={{ color: "#52525b" }}> — explain, compare, analyze, research, summarize</span>
            </div>
            <div>
              <span style={{ color: "#10b981" }}>● Nemotron (0-3)</span>
              <span style={{ color: "#52525b" }}> — short queries, simple questions, default fallback</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "0.5rem", paddingTop: "0.5rem", color: "#52525b" }}>
            Force a model: <span style={{ color: "#71717a" }}>c:</span> Claude · <span style={{ color: "#71717a" }}>g:</span> Gemini · <span style={{ color: "#71717a" }}>l:</span> Local
          </div>
        </div>
      )}
    </div>
  );
}
