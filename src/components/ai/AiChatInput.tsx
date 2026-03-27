import { useState, useRef, useCallback, useEffect, type JSX } from "react";

interface AiChatInputProps {
  onSubmit: (text: string) => void;
  onSlashCommand?: (command: string, args: string) => void;
  disabled: boolean;
}

const SLASH_COMMANDS = [
  { cmd: "/clear", description: "Clear chat history" },
  { cmd: "/settings", description: "Open settings" },
  { cmd: "/search", description: "Search in chat" },
  { cmd: "/palette", description: "Open command palette" },
  { cmd: "/preview", description: "Preview last response as rich markdown" },
  { cmd: "/help", description: "Show available commands" },
  { cmd: "/model", description: "Show current model info" },
  { cmd: "/budget", description: "Show budget status" },
];

export function AiChatInput({ onSubmit, onSlashCommand, disabled }: AiChatInputProps): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMultiline = value.includes("\n");
  const lineCount = value.split("\n").length;
  const showSlashHints = value.startsWith("/") && !value.includes(" ") && value.length < 12;

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || disabled) return;

    // Slash command handling
    if (trimmed.startsWith("/")) {
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1).join(" ");
      onSlashCommand?.(cmd, args);
      setValue("");
      return;
    }

    onSubmit(trimmed);
    setValue("");
    // Reset height for multi-line
    if (textareaRef.current) textareaRef.current.style.height = "";
  }, [value, disabled, onSubmit, onSlashCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
        if (!isMultiline) {
          e.preventDefault();
          handleSubmit();
        }
        return;
      }

      // Auto-close brackets
      const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
      if (pairs[e.key]) {
        const el = textareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          if (start !== end) {
            e.preventDefault();
            const selected = value.slice(start, end);
            const wrapped = `${e.key}${selected}${pairs[e.key]}`;
            const next = value.slice(0, start) + wrapped + value.slice(end);
            setValue(next);
            requestAnimationFrame(() => { el.selectionStart = start + 1; el.selectionEnd = end + 1; });
          }
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const el = textareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const next = value.slice(0, start) + "  " + value.slice(el.selectionEnd);
          setValue(next);
          requestAnimationFrame(() => { el.selectionStart = start + 2; el.selectionEnd = start + 2; });
        }
      }
    },
    [handleSubmit, isMultiline, value]
  );

  // Only auto-resize when actually multi-line
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    const el = textareaRef.current;
    if (!el) return;
    if (newValue.includes("\n")) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    } else {
      el.style.height = "";
    }
  }, []);

  const matchingCommands = showSlashHints
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value))
    : [];

  return (
    <div style={{ position: "relative" }}>
      {/* Slash command hints */}
      {matchingCommands.length > 0 && (
        <div style={{
          position: "absolute", bottom: "100%", left: 0, right: 0,
          background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "none", borderRadius: "0.375rem 0.375rem 0 0",
          padding: "0.25rem 0",
        }}>
          {matchingCommands.map((cmd) => (
            <div
              key={cmd.cmd}
              onClick={() => { setValue(cmd.cmd + " "); textareaRef.current?.focus(); }}
              style={{
                padding: "0.25rem 0.625rem", cursor: "pointer",
                display: "flex", justifyContent: "space-between",
                fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.6875rem",
              }}
            >
              <span style={{ color: "#a1a1aa" }}>{cmd.cmd}</span>
              <span style={{ color: "#3f3f46" }}>{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {isMultiline && (
            <div style={{
              padding: "0.625rem 0 0.625rem 0.5rem",
              fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.6875rem",
              color: "#27272a", lineHeight: 1.5, textAlign: "right",
              minWidth: "1.5rem", userSelect: "none", fontVariantNumeric: "tabular-nums",
            }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}

          {!isMultiline && (
            <span style={{
              color: "#3f3f46", fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.875rem", lineHeight: "2.5rem", flexShrink: 0,
              paddingLeft: "0.625rem",
            }}>
              &gt;
            </span>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Thinking..." : "Ask Cortex anything..."}
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#e4e4e7",
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.8125rem", lineHeight: isMultiline ? 1.5 : "2.5rem",
              height: isMultiline ? undefined : "2.5rem",
              resize: "none", overflow: "hidden",
              padding: isMultiline ? "0.625rem" : "0 0.5rem",
              margin: 0, tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { SLASH_COMMANDS };
