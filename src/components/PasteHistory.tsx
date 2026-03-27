import { useEffect, type JSX } from "react";
import type { PasteHistoryEntry } from "../hooks/usePasteHistory";

interface PasteHistoryProps {
  history: PasteHistoryEntry[];
  onSelect: (text: string) => void;
  onClose: () => void;
  onClear: () => void;
}

export function PasteHistory({
  history,
  onSelect,
  onClose,
  onClear,
}: PasteHistoryProps): JSX.Element {
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(32rem, 90vw)",
          maxHeight: "70vh",
          background: "#0d0d0d",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "0.5rem",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
          }}
        >
          <span
            style={{
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#e4e4e7",
            }}
          >
            Paste History
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                color: "#52525b",
                cursor: "pointer",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.625rem",
              }}
            >
              Clear
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#52525b",
                cursor: "pointer",
                fontSize: "0.875rem",
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Entries */}
        <div style={{ flex: 1, overflow: "auto", padding: "0.25rem" }}>
          {history.length === 0 && (
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                color: "#3f3f46",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.75rem",
              }}
            >
              No clipboard history yet
            </div>
          )}
          {history.map((entry, index) => (
            <button
              key={`${entry.timestamp}-${index}`}
              onClick={() => {
                navigator.clipboard.writeText(entry.text).catch(() => {});
                onSelect(entry.text);
                onClose();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.5rem 0.625rem",
                background: "transparent",
                border: "none",
                borderRadius: "0.375rem",
                color: "#d4d4d8",
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.6875rem",
                lineHeight: 1.5,
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255, 255, 255, 0.04)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              {entry.text.length > 120
                ? `${entry.text.slice(0, 120)}...`
                : entry.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
