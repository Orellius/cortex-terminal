import { useState, useRef, useCallback, useEffect, type JSX } from "react";

interface AiChatInputProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

/** IDE-like input editor with multi-line, auto-close, line numbers */
export function AiChatInput({ onSubmit, disabled }: AiChatInputProps): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMultiline = value.includes("\n");
  const lineCount = value.split("\n").length;

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || disabled) return;
    onSubmit(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+Enter always submits
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Enter: submit if single line, newline if multi-line
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
        if (!isMultiline) {
          e.preventDefault();
          handleSubmit();
        }
        // else: default behavior (newline)
        return;
      }

      // Auto-close brackets and quotes
      const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
      if (pairs[e.key]) {
        const el = textareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          if (start !== end) {
            // Wrap selection
            e.preventDefault();
            const selected = value.slice(start, end);
            const wrapped = `${e.key}${selected}${pairs[e.key]}`;
            const next = value.slice(0, start) + wrapped + value.slice(end);
            setValue(next);
            requestAnimationFrame(() => {
              el.selectionStart = start + 1;
              el.selectionEnd = end + 1;
            });
          } else if (e.key !== "'" && e.key !== '"') {
            // Insert pair (skip for quotes if preceded by alphanumeric)
            const charBefore = start > 0 ? value[start - 1] : "";
            if (!/\w/.test(charBefore)) {
              e.preventDefault();
              const next = value.slice(0, start) + e.key + pairs[e.key] + value.slice(end);
              setValue(next);
              requestAnimationFrame(() => {
                el.selectionStart = start + 1;
                el.selectionEnd = start + 1;
              });
            }
          }
        }
      }

      // Tab → insert 2 spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const el = textareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const next = value.slice(0, start) + "  " + value.slice(el.selectionEnd);
          setValue(next);
          requestAnimationFrame(() => {
            el.selectionStart = start + 2;
            el.selectionEnd = start + 2;
          });
        }
      }
    },
    [handleSubmit, isMultiline, value]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  return (
    <div>
      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          background: "transparent",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {/* Line numbers (only in multi-line mode) */}
          {isMultiline && (
            <div
              style={{
                padding: "0.625rem 0 0.625rem 0.5rem",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.6875rem",
                color: "#27272a",
                lineHeight: 1.5,
                textAlign: "right",
                minWidth: "1.5rem",
                userSelect: "none",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}

          {/* > arrow (single-line only) */}
          {!isMultiline && (
            <span
              style={{
                color: "#3f3f46",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.875rem",
                lineHeight: "1.5rem",
                flexShrink: 0,
                padding: "0.625rem 0 0 0.625rem",
              }}
            >
              &gt;
            </span>
          )}

          {/* Input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Thinking..." : "Ask Cortex anything..."}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e4e4e7",
              fontFamily: isMultiline
                ? '"Geist Mono", Menlo, monospace'
                : '"Geist Sans", -apple-system, sans-serif',
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              resize: "none",
              overflow: "hidden",
              padding: "0.625rem",
              margin: 0,
              tabSize: 2,
            }}
          />
        </div>

        {/* Footer hints */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 0.625rem 0.375rem",
            fontFamily: '"Geist Mono", Menlo, monospace',
            fontSize: "0.5rem",
            color: "rgba(255, 255, 255, 0.2)",
          }}
        >
          <span>
            {isMultiline ? "Cmd+Enter to send" : "Enter to send"}
            {!isMultiline && " · Shift+Enter for newline"}
          </span>
          <span>
            {value.length > 0 && `${value.length} chars`}
          </span>
        </div>
      </div>
    </div>
  );
}
