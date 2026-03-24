import type { JSX } from "react";
import type { ClaudeUsage } from "../types";
import { STATUS_BAR_HEIGHT } from "../constants";

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

export function StatusBar({
  branch,
  usage,
  onOpenLauncher,
}: StatusBarProps): JSX.Element {
  return (
    <div
      style={{
        height: STATUS_BAR_HEIGHT,
        minHeight: STATUS_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0 0.75rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        background: "#09090b",
        fontFamily: '"Geist Mono", monospace',
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
          fontSize: "0.625rem",
          cursor: "pointer",
          transition: "border-color 120ms ease, color 120ms ease",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
          e.currentTarget.style.color = "#71717a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
          e.currentTarget.style.color = "#52525b";
        }}
      >
        <span style={{ fontSize: "0.5625rem" }}>&#8984;</span>K
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Right: usage */}
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
      <span style={{ color: "#3f3f46" }}>zsh</span>
    </div>
  );
}
