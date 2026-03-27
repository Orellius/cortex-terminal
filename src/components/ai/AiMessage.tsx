import { useState, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  cost?: number;
  durationMs?: number;
  verified?: boolean;
  timestamp: number;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#8b5cf6",
  gemini: "#0ea5e9",
  ollama: "#10b981",
  system: "#f43f5e",
};

const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

const MODEL_DISPLAY: Record<string, string> = {
  "nemotron-cascade-2": "Nemotron Cascade 2",
  "nemotron-3-nano:4b": "Nemotron 3 Nano 4B",
  "nemotron-3-nano:30b": "Nemotron 3 Nano 30B",
  "qwen3.5:35b-a3b": "Qwen 3.5 35B",
  "deepseek-r1:32b": "DeepSeek R1 32B",
  "llama3.3:latest": "Llama 3.3 70B",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  sonnet: "Claude Sonnet",
  haiku: "Claude Haiku",
  opus: "Claude Opus",
};

interface AiMessageProps {
  message: ChatMessage;
  onOpenFile?: (path: string) => void;
  onOpenContent?: (content: string) => void;
}

export function AiMessage({ message, onOpenFile, onOpenContent }: AiMessageProps): JSX.Element {
  if (message.role === "user") {
    return <UserBlock content={message.content} timestamp={message.timestamp} />;
  }
  return <AssistantBlock message={message} onOpenFile={onOpenFile} onOpenContent={onOpenContent} />;
}

// ─── User Block ──────────────────────────────────────────────

function UserBlock({ content, timestamp }: { content: string; timestamp: number }): JSX.Element {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      style={{
        borderLeft: "2px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "0 0.375rem 0.375rem 0",
        background: "rgba(255, 255, 255, 0.02)",
        marginBottom: "0.25rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.375rem 0.625rem",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <span style={{ ...MONO, fontSize: "0.625rem", color: "#71717a", fontWeight: 600 }}>
          You
        </span>
        <span style={{ ...MONO, fontSize: "0.5625rem", color: "#27272a" }}>
          {time}
        </span>
      </div>
      {/* Body */}
      <div
        style={{
          padding: "0.375rem 0.625rem 0.5rem",
          fontFamily: '"Geist Sans", -apple-system, sans-serif',
          fontSize: "0.8125rem",
          color: "#e4e4e7",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ─── Assistant Block ─────────────────────────────────────────

function AssistantBlock({ message, onOpenFile, onOpenContent }: {
  message: ChatMessage;
  onOpenFile?: (path: string) => void;
  onOpenContent?: (content: string) => void;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const provider = message.provider ?? "ollama";
  const model = message.model ?? "";
  const color = PROVIDER_COLORS[provider] ?? "#52525b";
  const icon = PROVIDER_ICON[provider] ?? "○";
  const displayName = MODEL_DISPLAY[model] ?? model;
  const cost = message.cost ?? 0;
  const duration = ((message.durationMs ?? 0) / 1000).toFixed(1);
  const tokens = Math.round((message.content?.length ?? 0) / 4);
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const rendered = renderMarkdown(stripThinkTags(message.content));

  const handleCopy = useCallback(() => {
    const raw = stripThinkTags(message.content);
    navigator.clipboard.writeText(raw).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    const filePath = target.getAttribute("data-file-path");
    if (filePath && onOpenFile) { e.preventDefault(); onOpenFile(filePath); return; }

    const mdContent = target.getAttribute("data-md-content");
    if (mdContent && onOpenContent) { e.preventDefault(); onOpenContent(decodeURIComponent(mdContent)); return; }

    const runCmd = target.getAttribute("data-run-cmd");
    if (runCmd) {
      e.preventDefault();
      navigator.clipboard.writeText(decodeURIComponent(runCmd)).catch(() => {});
      target.textContent = "Copied!";
      setTimeout(() => { target.textContent = "Run"; }, 1500);
      return;
    }

    if (target.tagName === "A") {
      e.preventDefault();
      const href = target.getAttribute("href");
      if (href) invoke("open_external", { target: href }).catch(() => {});
    }
  }, [onOpenFile, onOpenContent]);

  return (
    <div
      style={{
        borderLeft: `2px solid ${color}`,
        borderRadius: "0 0.375rem 0.375rem 0",
        background: "rgba(255, 255, 255, 0.015)",
        marginBottom: "0.25rem",
        overflow: "hidden",
      }}
    >
      {/* Header — sticky-like with model info + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.625rem",
          background: "rgba(255, 255, 255, 0.02)",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        <span style={{ color, fontSize: "0.6875rem" }}>{icon}</span>
        <span style={{ ...MONO, color, fontSize: "0.625rem", fontWeight: 600 }}>
          {displayName || "Cortex"}
        </span>
        {message.verified === false && (
          <span style={{ ...MONO, fontSize: "0.5625rem", color: "#f59e0b" }}>[unverified]</span>
        )}

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Time */}
        <span style={{ ...MONO, fontSize: "0.5625rem", color: "#27272a" }}>{time}</span>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)} style={ACTION_BTN} title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? "+" : "-"}
        </button>

        {/* Copy */}
        <button onClick={handleCopy} style={ACTION_BTN} title="Copy response">
          {copied ? "ok" : "cp"}
        </button>
      </div>

      {/* Body — collapsible */}
      {!collapsed && (
        <div
          style={{
            padding: "0.375rem 0.625rem 0.25rem",
            fontFamily: '"Geist Sans", -apple-system, sans-serif',
            fontSize: "0.8125rem",
            color: "#d4d4d8",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      )}

      {/* Stats footer */}
      <div
        style={{
          padding: "0.25rem 0.625rem 0.375rem",
          display: "flex",
          gap: "0.5rem",
          ...MONO,
          fontSize: "0.5625rem",
          color: "#27272a",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{cost > 0 ? `$${cost.toFixed(4)}` : "$0"}</span>
        <span>~{tokens} tok</span>
        <span>{duration}s</span>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const MONO: React.CSSProperties = {
  fontFamily: '"Geist Mono", Menlo, monospace',
};

const ACTION_BTN: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "0.1875rem",
  padding: "0.0625rem 0.3125rem",
  color: "#3f3f46",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.5625rem",
  cursor: "pointer",
  lineHeight: 1.2,
};

// ─── Markdown Rendering ──────────────────────────────────────

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const escaped = codeBuffer.map(escapeHtml).join("\n");
        const rawContent = codeBuffer.join("\n");
        const langLabel = codeLang
          ? `<div style="font-size:0.625rem;color:#52525b;margin-bottom:0.25rem">${escapeHtml(codeLang)}</div>`
          : "";
        const isMarkdown = codeLang === "md" || codeLang === "markdown";
        const isShell = ["bash", "sh", "zsh", "shell", ""].includes(codeLang.toLowerCase());

        const buttons: string[] = [];
        if (isShell && rawContent.trim().length > 0) {
          buttons.push(`<button data-run-cmd="${encodeURIComponent(rawContent.trim())}" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:0.25rem;padding:0.125rem 0.4rem;color:#a1a1aa;font-family:'Geist Mono',Menlo,monospace;font-size:0.5625rem;cursor:pointer">Run</button>`);
        }
        if (isMarkdown) {
          buttons.push(`<button data-md-content="${encodeURIComponent(rawContent)}" style="background:rgba(5,160,239,0.1);border:1px solid rgba(5,160,239,0.2);border-radius:0.25rem;padding:0.125rem 0.4rem;color:#05a0ef;font-family:'Geist Mono',Menlo,monospace;font-size:0.5625rem;cursor:pointer">Preview</button>`);
        }
        const btnRow = buttons.length > 0
          ? `<div style="display:flex;gap:0.375rem;margin-top:0.25rem">${buttons.join("")}</div>`
          : "";

        result.push(
          `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:0.375rem;padding:0.5rem 0.625rem;margin:0.375rem 0;overflow-x:auto">${langLabel}<pre style="margin:0;white-space:pre-wrap;font-family:'Geist Mono',Menlo,monospace;font-size:0.75rem;color:#a1a1aa;line-height:1.5">${escaped}</pre>${btnRow}</div>`
        );
        codeLang = "";
      }
      continue;
    }

    if (inCodeBlock) { codeBuffer.push(line); continue; }

    let processed = escapeHtml(line);

    // Headers
    if (/^#{1,3}\s/.test(line)) {
      processed = processed.replace(/^#{1,3}\s+/, "");
      processed = `<strong style="color:#e4e4e7">${processed}</strong>`;
    }

    // **bold**
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e4e4e7">$1</strong>');

    // `inline code`
    processed = processed.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.06);padding:0.0625rem 0.25rem;border-radius:0.1875rem;font-family:\'Geist Mono\',Menlo,monospace;font-size:0.75rem;color:#a1a1aa">$1</code>'
    );

    // .md file references → clickable tags
    processed = processed.replace(
      /(?:^|\s)([\w./~-]+\.md)\b/g,
      (match, filePath: string) => {
        const tag = `<span data-file-path="${escapeHtml(filePath)}" style="color:#05a0ef;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(5,160,239,0.3);text-underline-offset:0.125rem">${escapeHtml(filePath)}</span>`;
        return match.startsWith(" ") ? ` ${tag}` : tag;
      }
    );

    // Bullet points
    if (/^\s*[-*]\s/.test(line)) {
      processed = processed.replace(/^\s*[-*]\s/, "  - ");
    }

    result.push(processed);
  }

  return result.join("<br>");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripThinkTags(content: string): string {
  let result = content;
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, "");
  result = result.replace(/<think>[\s\S]*/gi, "");
  const closeIdx = result.indexOf("</think>");
  if (closeIdx !== -1) result = result.substring(closeIdx + "</think>".length);
  result = result.replace(/<\/?quote>/gi, "");
  result = result.replace(/<\/?output>/gi, "");
  result = result.replace(/<\/?response>/gi, "");
  result = result.replace(/<\/?answer>/gi, "");
  result = result.replace(/^\n+/, "");
  return result.trim();
}
