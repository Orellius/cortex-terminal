import { useState, useEffect, useRef, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FolderOpen, Settings } from "lucide-react";
import type { ClaudeUsage } from "../types";

interface BudgetStatus {
  spent_today: number;
  limit: number;
  is_capped: boolean;
}

interface AiStreamEvent {
  pane_id: string;
  provider: string;
  model: string;
  chunk: string;
  done: boolean;
  cost: number;
  duration_ms: number;
  verified: boolean;
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

const MODEL_SHORT: Record<string, string> = {
  sonnet: "Sonnet",
  opus: "Opus",
  haiku: "Haiku",
  "gemini-2.0-flash": "Flash",
  "qwen3.5:35b-a3b": "Qwen 35B",
  "nemotron-cascade-2": "Cascade",
};

function usageColor(pct: number): string {
  if (pct >= 80) return "#f43f5e";
  if (pct >= 50) return "#f59e0b";
  return "#52525b";
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h${String(minutes % 60).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export function StatusBar({
  branch,
  usage,
  onOpenLauncher,
  onOpenSettings,
}: StatusBarProps): JSX.Element {
  const [budget, setBudget] = useState<BudgetStatus>({ spent_today: 0, limit: 5, is_capped: false });
  const [activeModel, setActiveModel] = useState<{ provider: string; model: string } | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [linesAdded, setLinesAdded] = useState(0);
  const [linesRemoved] = useState(0);
  const sessionStart = useRef(Date.now());

  // Poll providers + budget
  useEffect(() => {
    const check = () => {
      invoke<BudgetStatus>("get_budget_status").then(setBudget).catch(() => {});
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Session timer — tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionElapsed(Date.now() - sessionStart.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for AI stream events — track active model + line counts
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<AiStreamEvent>("cortex:ai:stream", (event) => {
      const d = event.payload;
      if (!d.done) {
        // Model is currently processing
        setActiveModel({ provider: d.provider, model: d.model });
      } else {
        // Count lines in response
        const lines = d.chunk.split("\n").length;
        setLinesAdded((prev) => prev + lines);
        // Clear active model after short delay
        setTimeout(() => setActiveModel(null), 1500);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
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
        background: "#010101",
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.6875rem",
        color: "#3f3f46",
        userSelect: "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {/* Git branch */}
      {branch !== "—" && branch && (
        <Badge color="#52525b" borderColor="rgba(255,255,255,0.06)">
          {branch}
        </Badge>
      )}

      {/* Actions */}
      <ActionBtn onClick={onOpenLauncher} title="Cmd+K" white><FolderOpen size={13} strokeWidth={1.5} /> Projects</ActionBtn>
      <ActionBtn onClick={onOpenSettings} title="Cmd+," white><Settings size={13} strokeWidth={1.5} /> Settings</ActionBtn>

      {/* Active model indicator — only shows when a model is responding */}
      {activeModel && (
        <Badge
          color={PROVIDER_COLORS[activeModel.provider] ?? "#52525b"}
          borderColor={`${PROVIDER_COLORS[activeModel.provider] ?? "#52525b"}44`}
        >
          <span style={{ fontSize: "0.625rem" }}>
            {PROVIDER_ICONS[activeModel.provider] ?? "○"}
          </span>
          {MODEL_SHORT[activeModel.model] ?? activeModel.model}
          <span style={{ color: "#52525b", fontSize: "0.5625rem" }}>typing</span>
        </Badge>
      )}


      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Lines added/removed */}
      {(linesAdded > 0 || linesRemoved > 0) && (
        <Badge color="#52525b" borderColor="rgba(255,255,255,0.06)">
          {linesAdded > 0 && (
            <span style={{ color: "#10b981" }}>+{linesAdded}</span>
          )}
          {linesRemoved > 0 && (
            <span style={{ color: "#f43f5e" }}>-{linesRemoved}</span>
          )}
        </Badge>
      )}

      {/* Cost */}
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

      {/* Claude usage */}
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

      {/* Session time */}
      <Badge color="#3f3f46" borderColor="rgba(255,255,255,0.06)">
        {formatDuration(sessionElapsed)}
      </Badge>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────

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

function ActionBtn({ children, onClick, title, white }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  white?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.5rem",
        borderRadius: "0.25rem",
        border: white ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.06)",
        background: "transparent",
        color: white ? "#d4d4d8" : "#52525b",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.6875rem",
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
