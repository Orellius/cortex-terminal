import { useState, useEffect, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface MarkdownSidebarProps {
  filePath: string | null;
  content: string | null;
  onClose: () => void;
}

/**
 * Right-side slide-out panel for rendered markdown.
 * Triggered by clicking .md file references in AI chat.
 * Shows either file content (from disk) or inline content (from chat).
 */
export function MarkdownSidebar({
  filePath,
  content: inlineContent,
  onClose,
}: MarkdownSidebarProps): JSX.Element | null {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file content if filePath provided
  useEffect(() => {
    if (inlineContent) {
      setContent(inlineContent);
      setError(null);
      return;
    }
    if (!filePath) return;

    setLoading(true);
    setError(null);
    invoke<string>("read_file_content", { path: filePath })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoading(false);
      });
  }, [filePath, inlineContent]);

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

  const isOpen = filePath !== null || inlineContent !== null;
  if (!isOpen) return null;

  const displayName = filePath
    ? filePath.split("/").pop() ?? filePath
    : "Preview";

  const rendered = renderMarkdownToHtml(content);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "40%",
        minWidth: "20rem",
        maxWidth: "36rem",
        background: "#0d0d0d",
        borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        animation: "slideInRight 150ms ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.625rem 0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: '"Geist Mono", Menlo, monospace',
            fontSize: "0.6875rem",
            color: "#a1a1aa",
            fontWeight: 600,
          }}
        >
          {displayName}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#52525b",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
            lineHeight: 1,
          }}
          title="Close (Esc)"
        >
          x
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "1rem",
        }}
      >
        {loading && (
          <div style={{ color: "#52525b", fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.75rem" }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{ color: "#f43f5e", fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.75rem" }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <div
            style={{
              fontFamily: '"Geist Sans", -apple-system, sans-serif',
              fontSize: "0.8125rem",
              color: "#d4d4d8",
              lineHeight: 1.7,
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        )}
      </div>
    </div>
  );
}

/** Convert markdown text to styled HTML */
function renderMarkdownToHtml(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";
  let inList = false;

  for (const line of lines) {
    // Code blocks
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        if (inList) { result.push("</ul>"); inList = false; }
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const escaped = codeBuffer.map(escapeHtml).join("\n");
        const langLabel = codeLang
          ? `<div style="font-size:0.625rem;color:#52525b;margin-bottom:0.25rem;font-family:'Geist Mono',Menlo,monospace">${escapeHtml(codeLang)}</div>`
          : "";
        result.push(
          `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:0.375rem;padding:0.625rem 0.75rem;margin:0.5rem 0;overflow-x:auto">${langLabel}<pre style="margin:0;white-space:pre-wrap;font-family:'Geist Mono',Menlo,monospace;font-size:0.75rem;color:#a1a1aa;line-height:1.6">${escaped}</pre></div>`
        );
        codeLang = "";
      }
      continue;
    }
    if (inCodeBlock) { codeBuffer.push(line); continue; }

    // Empty line
    if (line.trim() === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push("<br>");
      continue;
    }

    let processed = escapeHtml(line);

    // Headers
    const headerMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      if (inList) { result.push("</ul>"); inList = false; }
      const level = headerMatch[1].length;
      const sizes = ["1.125rem", "1rem", "0.875rem", "0.8125rem"];
      const text = escapeHtml(headerMatch[2]);
      result.push(
        `<div style="font-size:${sizes[level - 1]};font-weight:600;color:#e4e4e7;margin:0.75rem 0 0.375rem">${text}</div>`
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0.75rem 0">');
      continue;
    }

    // List items
    if (/^\s*[-*+]\s/.test(line)) {
      if (!inList) { result.push('<ul style="margin:0.25rem 0;padding-left:1.25rem">'); inList = true; }
      const itemText = processed.replace(/^\s*[-*+]\s+/, "");
      result.push(`<li style="margin:0.125rem 0">${applyInlineFormatting(itemText)}</li>`);
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      if (!inList) { result.push('<ol style="margin:0.25rem 0;padding-left:1.25rem">'); inList = true; }
      const itemText = processed.replace(/^\s*\d+\.\s+/, "");
      result.push(`<li style="margin:0.125rem 0">${applyInlineFormatting(itemText)}</li>`);
      continue;
    }

    if (inList) { result.push("</ul>"); inList = false; }

    // Regular paragraph
    result.push(`<p style="margin:0.25rem 0">${applyInlineFormatting(processed)}</p>`);
  }

  if (inList) result.push("</ul>");
  return result.join("");
}

function applyInlineFormatting(text: string): string {
  // **bold**
  let result = text.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e4e4e7">$1</strong>');
  // *italic*
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // `inline code`
  result = result.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.06);padding:0.0625rem 0.25rem;border-radius:0.1875rem;font-family:\'Geist Mono\',Menlo,monospace;font-size:0.75rem;color:#a1a1aa">$1</code>'
  );
  // [link](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#05a0ef;text-decoration:none" target="_blank">$1</a>'
  );
  return result;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
