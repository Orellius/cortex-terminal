import { useState, useEffect, useRef } from "react";
import type { JSX, KeyboardEvent } from "react";
import type { LauncherProps, ProjectEntry } from "../types";

export function ProjectLauncher({
  projects,
  onSelect,
  onClose,
}: LauncherProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  const clampedIndex =
    filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);

  // Reset selection when query changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Autofocus input when modal mounts.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view.
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[clampedIndex] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length === 0 ? 0 : Math.min(prev + 1, filtered.length - 1)
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const project = filtered[clampedIndex];
      if (project) onSelect(project);
      return;
    }
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1a1a1e",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.5rem",
          width: "28rem",
          maxHeight: "24rem",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search projects..."
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            outline: "none",
            width: "100%",
            padding: "0.75rem",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "0.875rem",
            color: "#d4d4d8",
            boxSizing: "border-box",
          }}
        />

        {/* Results list */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "0.75rem",
                fontFamily: '"Geist Mono", monospace',
                fontSize: "0.8125rem",
                color: "#52525b",
              }}
            >
              No projects found
            </div>
          ) : (
            filtered.map((project: ProjectEntry, idx: number) => {
              const isActive = idx === clampedIndex;
              return (
                <div
                  key={project.path}
                  onClick={() => onSelect(project)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    fontFamily: '"Geist Mono", monospace',
                    fontSize: "0.8125rem",
                    color: isActive ? "#fafafa" : "#a1a1aa",
                    background: isActive
                      ? "rgba(5, 160, 239, 0.125)"
                      : "transparent",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "background 80ms ease, color 80ms ease",
                  }}
                >
                  {project.name}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
