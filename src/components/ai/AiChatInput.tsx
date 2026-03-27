import { useState, useRef, useCallback, useEffect, type JSX } from "react";

interface AiChatInputProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export function AiChatInput({ onSubmit, disabled }: AiChatInputProps): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount and when enabled
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || disabled) return;
    onSubmit(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  return (
    <div
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        padding: "0.75rem 1rem",
        background: "rgba(255, 255, 255, 0.02)",
        display: "flex",
        alignItems: "flex-end",
        gap: "0.5rem",
      }}
    >
      {/* > arrow */}
      <span
        style={{
          color: "#3f3f46",
          fontFamily: '"Geist Mono", Menlo, monospace',
          fontSize: "0.875rem",
          lineHeight: "1.5rem",
          flexShrink: 0,
          paddingBottom: "0.125rem",
        }}
      >
        &gt;
      </span>

      {/* Input area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? "Thinking..." : "Type naturally. Models route automatically."}
        rows={1}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#e4e4e7",
          fontFamily: '"Geist Sans", -apple-system, sans-serif',
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          resize: "none",
          overflow: "hidden",
          padding: 0,
          margin: 0,
        }}
      />

      {/* Shift+Enter hint */}
      {value.length > 0 && (
        <span
          style={{
            color: "#27272a",
            fontFamily: '"Geist Mono", Menlo, monospace',
            fontSize: "0.5625rem",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          shift+enter for newline
        </span>
      )}
    </div>
  );
}
