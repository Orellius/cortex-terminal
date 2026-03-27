import { useState, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import katex from "katex";

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
  streaming?: boolean;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#8b5cf6", ollama: "#10b981", system: "#f43f5e",
};

const MODEL_DISPLAY: Record<string, string> = {
  "nemotron-cascade-2": "nemotron", "qwen3.5:35b-a3b": "qwen-35b",
  "deepseek-r1:32b": "deepseek-32b", sonnet: "sonnet", haiku: "haiku", opus: "opus",
};

interface AiMessageProps {
  message: ChatMessage;
  onOpenFile?: (path: string) => void;
  onOpenContent?: (content: string) => void;
}

export function AiMessage({ message, onOpenFile, onOpenContent }: AiMessageProps): JSX.Element {
  if (message.role === "user") return <UserLine content={message.content} />;
  return <AssistantOutput message={message} onOpenFile={onOpenFile} onOpenContent={onOpenContent} />;
}

// ─── User: terminal prompt line ─────────────────────────────

function UserLine({ content }: { content: string }): JSX.Element {
  return (
    <div style={{ ...MONO, fontSize: "0.8125rem", color: "#a1a1aa", lineHeight: 1.6, padding: "0.25rem 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      <span style={{ color: "#3f3f46", marginRight: "0.5rem", userSelect: "none" }}>&gt;</span>
      {content}
    </div>
  );
}

// ─── Assistant: raw terminal output ─────────────────────────

function AssistantOutput({ message, onOpenFile, onOpenContent }: {
  message: ChatMessage;
  onOpenFile?: (path: string) => void;
  onOpenContent?: (content: string) => void;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const provider = message.provider ?? "ollama";
  const model = message.model ?? "";
  const color = PROVIDER_COLORS[provider] ?? "#52525b";
  const displayName = MODEL_DISPLAY[model] ?? model;
  const cost = message.cost ?? 0;
  const duration = ((message.durationMs ?? 0) / 1000).toFixed(1);
  const tokens = Math.round((message.content?.length ?? 0) / 4);

  const rendered = renderMarkdown(stripThinkTags(message.content))
    + (message.streaming ? '<span style="color:#8b5cf6;opacity:0.8">▌</span>' : '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(stripThinkTags(message.content)).catch(() => {});
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
    <div style={{ padding: "0.25rem 0", marginBottom: "0.125rem" }}>
      {/* Model indicator — minimal, inline */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.125rem" }}>
        <span style={{ color, fontSize: "0.5rem" }}>●</span>
        <span style={{ ...MONO, color: "#3f3f46", fontSize: "0.5625rem" }}>{displayName || "cortex"}</span>
        {message.verified === false && (
          <span style={{ ...MONO, fontSize: "0.5rem", color: "#f59e0b" }}>unverified</span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={() => setCollapsed(!collapsed)} style={GHOST_BTN}>{collapsed ? "+" : "−"}</button>
        <button onClick={handleCopy} style={GHOST_BTN}>{copied ? "✓" : "cp"}</button>
      </div>

      {/* Content — raw text, no card */}
      {!collapsed && (
        <div
          style={{ ...MONO, fontSize: "0.8125rem", color: "#d4d4d8", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      )}

      {/* Stats — ultra-subtle, inline */}
      {!message.streaming && !collapsed && (
        <div style={{ ...MONO, fontSize: "0.5rem", color: "#1c1c1e", marginTop: "0.125rem", fontVariantNumeric: "tabular-nums" }}>
          {cost > 0 ? `$${cost.toFixed(4)}` : "$0"} · ~{tokens}tok · {duration}s
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

const GHOST_BTN: React.CSSProperties = {
  background: "none", border: "none", color: "#27272a", ...MONO,
  fontSize: "0.5rem", cursor: "pointer", padding: "0 0.25rem", lineHeight: 1,
};

// ─── Markdown Rendering ─────────────────────────────────────

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
          ? `<span style="font-size:0.5625rem;color:#3f3f46">${escapeHtml(codeLang)}</span> `
          : "";
        const isShell = ["bash", "sh", "zsh", "shell", ""].includes(codeLang.toLowerCase());
        const isMd = codeLang === "md" || codeLang === "markdown";
        const btns: string[] = [];
        if (isShell && rawContent.trim()) {
          btns.push(`<button data-run-cmd="${encodeURIComponent(rawContent.trim())}" style="background:none;border:1px solid rgba(255,255,255,0.06);border-radius:0.1875rem;padding:0.0625rem 0.3rem;color:#3f3f46;font-family:'Geist Mono',Menlo,monospace;font-size:0.5rem;cursor:pointer">run</button>`);
        }
        if (isMd) {
          btns.push(`<button data-md-content="${encodeURIComponent(rawContent)}" style="background:none;border:1px solid rgba(5,160,239,0.15);border-radius:0.1875rem;padding:0.0625rem 0.3rem;color:#05a0ef;font-family:'Geist Mono',Menlo,monospace;font-size:0.5rem;cursor:pointer">view</button>`);
        }
        const btnRow = btns.length > 0 ? `<span style="margin-left:0.5rem">${btns.join(" ")}</span>` : "";
        result.push(
          `<div style="border-left:2px solid rgba(255,255,255,0.04);padding:0.375rem 0.625rem;margin:0.25rem 0">${langLabel}${btnRow}<pre style="margin:0.25rem 0 0;white-space:pre-wrap;font-size:0.75rem;color:#71717a;line-height:1.5">${escaped}</pre></div>`
        );
        codeLang = "";
      }
      continue;
    }
    if (inCodeBlock) { codeBuffer.push(line); continue; }

    let processed = escapeHtml(line);
    if (/^#{1,3}\s/.test(line)) {
      processed = processed.replace(/^#{1,3}\s+/, "");
      processed = `<strong style="color:#e4e4e7">${processed}</strong>`;
    }
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e4e4e7">$1</strong>');
    processed = processed.replace(/`([^`]+)`/g, '<code style="color:#71717a;font-size:0.75rem">$1</code>');
    processed = processed.replace(
      /(?:^|\s)([\w./~-]+\.md)\b/g,
      (match, fp: string) => {
        const tag = `<span data-file-path="${escapeHtml(fp)}" style="color:#05a0ef;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(5,160,239,0.2)">${escapeHtml(fp)}</span>`;
        return match.startsWith(" ") ? ` ${tag}` : tag;
      }
    );
    if (/^\s*[-*]\s/.test(line)) processed = processed.replace(/^\s*[-*]\s/, "  - ");
    result.push(processed);
  }
  return renderLatex(result.join("<br>"));
}

/** Render LaTeX math notation via KaTeX */
function renderLatex(html: string): string {
  // Display math: \[...\] or $$...$$  (may span multiple lines via <br>)
  let output = html.replace(
    /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g,
    (_match, g1: string | undefined, g2: string | undefined) => {
      const tex = (g1 ?? g2 ?? "").replace(/<br\s*\/?>/g, "\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
      try {
        return `<div style="margin:0.5rem 0;overflow-x:auto">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `<pre style="color:#71717a">${tex}</pre>`;
      }
    }
  );

  // Inline math: \(...\) or $...$  (single $ must not be currency — require backslash content)
  output = output.replace(
    /\\\((.+?)\\\)/g,
    (_match, tex: string) => {
      const cleaned = tex.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
      try {
        return katex.renderToString(cleaned.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return cleaned;
      }
    }
  );

  return output;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripThinkTags(content: string): string {
  let r = content;
  r = r.replace(/<think>[\s\S]*?<\/think>/gi, "");
  r = r.replace(/<think>[\s\S]*/gi, "");
  const ci = r.indexOf("</think>");
  if (ci !== -1) r = r.substring(ci + 8);
  r = r.replace(/<\/?(?:quote|output|response|answer)>/gi, "");
  return r.replace(/^\n+/, "").trim();
}
