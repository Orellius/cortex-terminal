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

  useEffect(() => { setSelectedIndex(0); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[clampedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) => filtered.length === 0 ? 0 : Math.min(p + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const project = filtered[clampedIndex];
      if (project) onSelect(project);
    }
  };

  // Split "category/name" for display
  const renderName = (name: string, isActive: boolean) => {
    const parts = name.split("/");
    if (parts.length === 2) {
      return (
        <>
          <span style={{ color: isActive ? "#71717a" : "#3f3f46" }}>
            {parts[0]}/
          </span>
          <span>{parts[1]}</span>
        </>
      );
    }
    return <span>{name}</span>;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111114",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.625rem",
          width: "min(30rem, 90vw)",
          maxHeight: "min(22rem, 60vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 1.5rem 4rem rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}>
          <span style={{
            color: "#3f3f46",
            fontFamily: '"Geist Mono", monospace',
            fontSize: "0.875rem",
          }}>
            &gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to project..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              flex: 1,
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.875rem",
              color: "#e4e4e7",
              letterSpacing: "0.02em",
            }}
          />
          <span style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: "0.625rem",
            color: "#3f3f46",
            padding: "0.125rem 0.375rem",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "0.2rem",
          }}>
            esc
          </span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: "0.25rem 0" }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "1rem",
              fontFamily: '"Geist Mono", monospace',
              fontSize: "0.8rem",
              color: "#3f3f46",
              textAlign: "center",
            }}>
              No projects match "{query}"
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
                    padding: "0.5rem 1rem",
                    fontFamily: '"Geist Mono", Menlo, monospace',
                    fontSize: "0.8rem",
                    color: isActive ? "#e4e4e7" : "#a1a1aa",
                    background: isActive
                      ? "rgba(5, 160, 239, 0.08)"
                      : "transparent",
                    borderLeft: isActive
                      ? "2px solid #05a0ef"
                      : "2px solid transparent",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 60ms ease",
                    letterSpacing: "0.01em",
                  }}
                >
                  {renderName(project.name, isActive)}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
