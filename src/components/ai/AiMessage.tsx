import { type JSX } from "react";

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
    return <UserMessage content={message.content} />;
  }
  return <AssistantMessage message={message} onOpenFile={onOpenFile} onOpenContent={onOpenContent} />;
}

function UserMessage({ content }: { content: string }): JSX.Element {
  return (
    <div style={{ padding: "0.5rem 0" }}>
      <div
        style={{
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

function AssistantMessage({ message, onOpenFile, onOpenContent }: {
  message: ChatMessage;
  onOpenFile?: (path: string) => void;
  onOpenContent?: (content: string) => void;
}): JSX.Element {
  const provider = message.provider ?? "ollama";
  const model = message.model ?? "";
  const color = PROVIDER_COLORS[provider] ?? "#52525b";
  const icon = PROVIDER_ICON[provider] ?? "○";
  const displayName = MODEL_DISPLAY[model] ?? model;
  const cost = message.cost ?? 0;
  const duration = ((message.durationMs ?? 0) / 1000).toFixed(1);
  const tokens = Math.round((message.content?.length ?? 0) / 4);

  const rendered = renderMarkdown(stripThinkTags(message.content));

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {/* Provider badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          marginBottom: "0.375rem",
        }}
      >
        <span style={{ color, fontSize: "0.6875rem" }}>{icon}</span>
        <span
          style={{
            color,
            fontSize: "0.6875rem",
            fontWeight: 600,
            fontFamily: '"Geist Mono", Menlo, monospace',
          }}
        >
          {displayName}
        </span>
        {message.verified === false && (
          <span
            style={{
              fontSize: "0.625rem",
              color: "#f59e0b",
              fontFamily: '"Geist Mono", Menlo, monospace',
            }}
          >
            [unverified]
          </span>
        )}
      </div>

      {/* Response body */}
      <div
        style={{
          fontFamily: '"Geist Sans", -apple-system, sans-serif',
          fontSize: "0.8125rem",
          color: "#d4d4d8",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const filePath = target.getAttribute("data-file-path");
          if (filePath && onOpenFile) {
            e.preventDefault();
            onOpenFile(filePath);
          }
          const mdContent = target.getAttribute("data-md-content");
          if (mdContent && onOpenContent) {
            e.preventDefault();
            onOpenContent(decodeURIComponent(mdContent));
          }
        }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: rendered }}
      />

      {/* Stats footer */}
      <div
        style={{
          marginTop: "0.375rem",
          fontFamily: '"Geist Mono", Menlo, monospace',
          fontSize: "0.625rem",
          color: "#3f3f46",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {cost > 0 ? `$${cost.toFixed(4)}` : "$0"} · ~{tokens} tokens · {duration}s
      </div>
    </div>
  );
}

/** Basic HTML markdown rendering with clickable .md file tags */
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
        // If it's markdown content, make the block clickable to open in sidebar
        const isMarkdown = codeLang === "md" || codeLang === "markdown";
        const clickAttr = isMarkdown
          ? ` data-md-content="${encodeURIComponent(rawContent)}" style="cursor:pointer;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:0.375rem;padding:0.5rem 0.625rem;margin:0.375rem 0;font-family:'Geist Mono',Menlo,monospace;font-size:0.75rem;color:#a1a1aa;overflow-x:auto"`
          : ` style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:0.375rem;padding:0.5rem 0.625rem;margin:0.375rem 0;font-family:'Geist Mono',Menlo,monospace;font-size:0.75rem;color:#a1a1aa;overflow-x:auto"`;
        const viewHint = isMarkdown
          ? `<div style="font-size:0.5625rem;color:#05a0ef;margin-top:0.25rem;cursor:pointer" data-md-content="${encodeURIComponent(rawContent)}">Click to preview</div>`
          : "";
        result.push(
          `<div${clickAttr}>${langLabel}<pre style="margin:0;white-space:pre-wrap">${escaped}</pre>${viewHint}</div>`
        );
        codeLang = "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    let processed = escapeHtml(line);

    // Headers
    if (/^#{1,3}\s/.test(line)) {
      processed = processed.replace(
        /^#{1,3}\s+/,
        ""
      );
      processed = `<strong>${processed}</strong>`;
    }

    // **bold**
    processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // `inline code`
    processed = processed.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.06);padding:0.125rem 0.25rem;border-radius:0.25rem;font-family:\'Geist Mono\',Menlo,monospace;font-size:0.75rem;color:#a1a1aa">$1</code>'
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
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripThinkTags(content: string): string {
  let result = content;
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, "");
  result = result.replace(/<think>[\s\S]*/gi, "");
  const closeIdx = result.indexOf("</think>");
  if (closeIdx !== -1) {
    result = result.substring(closeIdx + "</think>".length);
  }
  result = result.replace(/<\/?quote>/gi, "");
  result = result.replace(/<\/?output>/gi, "");
  result = result.replace(/<\/?response>/gi, "");
  result = result.replace(/<\/?answer>/gi, "");
  result = result.replace(/^\n+/, "");
  return result.trim();
}
