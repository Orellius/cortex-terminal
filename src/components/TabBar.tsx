import { useState } from "react";
import type { JSX } from "react";
import type { Tab } from "../types";
import { TAB_BAR_HEIGHT } from "../constants";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  homeDir: string;
  onAdd: () => void;
  onAddShell?: () => void;
  onClose: (id: string) => void;
  onSwitch: (id: string) => void;
}

function shortenPath(fullPath: string, homeDir: string): string {
  const withTilde = homeDir ? fullPath.replace(homeDir, "~") : fullPath;
  const parts = withTilde.split("/");
  const last = parts[parts.length - 1] ?? withTilde;
  return last || "~";
}

export function TabBar({
  tabs,
  activeTabId,
  homeDir,
  onAdd,
  onClose,
  onSwitch,
}: TabBarProps): JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      data-tauri-drag-region=""
      style={{
        height: TAB_BAR_HEIGHT,
        minHeight: TAB_BAR_HEIGHT,
        display: "flex",
        alignItems: "stretch",
        background: "#09090b",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isHovered = hoveredId === tab.id;
        const label = shortenPath(tab.title || tab.cwd, homeDir);
        const showClose = tabs.length > 1 && isHovered;

        return (
          <div
            key={tab.id}
            onMouseEnter={() => setHoveredId(tab.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSwitch(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.75rem",
              cursor: "pointer",
              borderBottom: isActive
                ? "2px solid #05a0ef"
                : "2px solid transparent",
              color: isActive
                ? "#e4e4e7"
                : isHovered
                ? "#71717a"
                : "#52525b",
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.75rem",
              userSelect: "none",
              flexShrink: 0,
              transition: "color 150ms ease",
              position: "relative",
            }}
          >
            <span
              style={{
                maxWidth: "10rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>

            {showClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1rem",
                  height: "1rem",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#52525b",
                  fontFamily: '"Geist Mono", Menlo, monospace',
                  fontSize: "0.75rem",
                  lineHeight: 1,
                  borderRadius: "0.125rem",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#e4e4e7";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#52525b";
                }}
              >
                ×
              </button>
            )}

            {!showClose && (
              <span style={{ width: "1rem", flexShrink: 0 }} />
            )}
          </div>
        );
      })}

      <button
        onClick={onAdd}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.25rem 0.625rem",
          background: "none",
          border: "none",
          borderBottom: "2px solid transparent",
          cursor: "pointer",
          color: "#52525b",
          fontFamily: '"Geist Mono", Menlo, monospace',
          fontSize: "0.875rem",
          lineHeight: 1,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#71717a";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#52525b";
        }}
      >
        +
      </button>

      {/* Draggable spacer — fills remaining tab bar width */}
      <div
        data-tauri-drag-region=""
        style={{ flex: 1, minWidth: "2rem" }}
      />
    </div>
  );
}
