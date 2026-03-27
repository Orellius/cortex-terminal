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

function usageColor(pct: number): string {
  if (pct >= 80) return "#f43f5e";
  if (pct >= 50) return "#f59e0b";
  return "#52525b";
}

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
        height: "2.5rem",
        minHeight: "2.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0 0.75rem",
        background: "transparent",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.6875rem",
        color: "#3f3f46",
        userSelect: "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Git branch badge */}
      {branch !== "—" && branch && (
        <Badge color="#52525b" borderColor="rgba(255,255,255,0.06)">
          {branch}
        </Badge>
      )}

      {/* Action buttons */}
      <ActionBtn onClick={onOpenLauncher} title="Cmd+K">Projects</ActionBtn>
      <ActionBtn onClick={onOpenSettings} title="Cmd+,">Settings</ActionBtn>

      {/* Model badges — with connection status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {providers.map((p) => {
          const color = PROVIDER_COLORS[p.kind] ?? "#52525b";
          const icon = PROVIDER_ICONS[p.kind] ?? "○";
          return (
            <Badge
              key={p.kind}
              color={p.available ? color : "#27272a"}
              borderColor={p.available ? `${color}33` : "rgba(255,255,255,0.04)"}
              title={`${p.name}: ${p.available ? p.model : "offline"}`}
            >
              <span
                style={{
                  width: "0.375rem",
                  height: "0.375rem",
                  borderRadius: "50%",
                  background: p.available ? color : "#27272a",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "0.625rem" }}>{icon}</span>
              {p.name}
            </Badge>
          );
        })}
      </div>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* API Cost — labeled with cloud icon */}
      <Badge
        color={budget.is_capped ? "#f43f5e" : "#3f3f46"}
        borderColor={budget.is_capped ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.06)"}
      >
        <span style={{ color: "#52525b", fontSize: "0.5625rem" }}>cost</span>
        {costStr}
        {budget.is_capped && (
          <span style={{ color: "#f43f5e", fontSize: "0.5625rem" }}>capped</span>
        )}
      </Badge>

      {/* Claude session/weekly — labeled clearly */}
      <Badge color="#8b5cf6" borderColor="rgba(139,92,246,0.15)">
        <span style={{ fontSize: "0.625rem" }}>◆</span>
        <span style={{ color: "#52525b", fontSize: "0.5625rem" }}>session</span>
        <span style={{ color: usageColor(usage.session_pct) }}>
          {Math.round(usage.session_pct)}%
        </span>
        <span style={{ color: "#27272a" }}>|</span>
        <span style={{ color: "#52525b", fontSize: "0.5625rem" }}>weekly</span>
        <span style={{ color: usageColor(usage.weekly_pct) }}>
          {Math.round(usage.weekly_pct)}%
        </span>
      </Badge>
    </div>
  );
}

// ─── Reusable Badge Component ────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  borderColor?: string;
  title?: string;
  onClick?: () => void;
}

function Badge({ children, color = "#52525b", borderColor = "rgba(255,255,255,0.06)", title, onClick }: BadgeProps): JSX.Element {
  return (
    <span
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.4rem",
        borderRadius: "0.25rem",
        border: `1px solid ${borderColor}`,
        color,
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.625rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </span>
  );
}

// ─── Action Button ───────────────────────────────────────────

function ActionBtn({ children, onClick, title }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.4rem",
        borderRadius: "0.25rem",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        background: "transparent",
        color: "#52525b",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.625rem",
        cursor: "pointer",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        transition: "color 100ms, border-color 100ms",
      }}
    >
      {children}
      <span style={{ fontSize: "0.5625rem", color: "#27272a" }}>{title}</span>
    </button>
  );
}
