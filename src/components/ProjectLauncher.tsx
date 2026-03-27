import { useState, useEffect, useRef, useCallback } from "react";
import type { JSX, KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import type { ProjectEntry } from "../types";

interface LauncherProps {
  projects: ProjectEntry[];
  onSelect: (project: ProjectEntry) => void;
  onClose: () => void;
}

type Tab = "projects" | "recents";
const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function ProjectLauncher({ projects, onSelect, onClose }: LauncherProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [recents, setRecents] = useState<ProjectEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    invoke<ProjectEntry[]>("get_recent_projects").then(setRecents).catch(() => {});
  }, []);

  const items = activeTab === "recents" ? recents : projects;
  const filtered = items.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.path.toLowerCase().includes(query.toLowerCase())
  );
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);

  useEffect(() => { setSelectedIndex(0); }, [query, activeTab]);
  useEffect(() => {
    const item = listRef.current?.children[clampedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex]);

  const selectProject = useCallback((project: ProjectEntry) => {
    invoke("save_recent_project", { path: project.path }).catch(() => {});
    onSelect(project);
  }, [onSelect]);

  const browseDirectory = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Choose project directory" });
      if (selected && typeof selected === "string") {
        const name = selected.split("/").pop() ?? selected;
        selectProject({ name, path: selected });
      }
    } catch {
      // User cancelled
    }
  }, [selectProject]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); return; }
    if (e.key === "Tab") { e.preventDefault(); setActiveTab((t) => t === "projects" ? "recents" : "projects"); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const project = filtered[clampedIndex];
      if (project) selectProject(project);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#010101", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.375rem", width: "min(34rem, 90vw)", maxHeight: "min(26rem, 65vh)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ ...MONO, color: "#3f3f46", fontSize: "0.8125rem" }}>&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to project..."
            style={{ ...MONO, flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.8125rem", color: "#e4e4e7" }}
          />
          <button
            onClick={browseDirectory}
            title="Browse directory"
            style={{ ...MONO, display: "flex", alignItems: "center", gap: "0.25rem", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", color: "#71717a", fontSize: "0.625rem", cursor: "pointer" }}
          >
            <FolderOpen size={11} strokeWidth={1.5} /> Browse
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "0 0.5rem" }}>
          {(["projects", "recents"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...MONO, fontSize: "0.625rem", padding: "0.375rem 0.625rem",
                background: activeTab === tab ? "rgba(255,255,255,0.04)" : "transparent",
                border: "none", borderRadius: "0.25rem 0.25rem 0 0",
                color: activeTab === tab ? "#a1a1aa" : "#3f3f46",
                cursor: "pointer",
              }}
            >
              {tab === "projects" ? "Projects" : "Recents"}
              {tab === "recents" && recents.length > 0 && (
                <span style={{ color: "#27272a", marginLeft: "0.25rem" }}>{recents.length}</span>
              )}
            </button>
          ))}
          <span style={{ ...MONO, fontSize: "0.5rem", color: "#27272a", marginLeft: "auto", alignSelf: "center" }}>Tab to switch</span>
        </div>

        {/* List */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: "0.125rem 0" }}>
          {filtered.length === 0 ? (
            <div style={{ ...MONO, fontSize: "0.75rem", color: "#27272a", textAlign: "center", padding: "1.5rem" }}>
              {activeTab === "recents" ? "No recent projects" : `No projects match "${query}"`}
            </div>
          ) : (
            filtered.map((project, idx) => {
              const isActive = idx === clampedIndex;
              return (
                <div
                  key={project.path}
                  onClick={() => selectProject(project)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.375rem 0.75rem", cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    borderLeft: isActive ? "2px solid rgba(255,255,255,0.2)" : "2px solid transparent",
                  }}
                >
                  <span style={{ ...MONO, fontSize: "0.75rem", color: isActive ? "#e4e4e7" : "#71717a" }}>
                    {project.name}
                  </span>
                  <span style={{ ...MONO, fontSize: "0.5625rem", color: "#27272a", maxWidth: "14rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {project.path.replace(/^\/Users\/[^/]+/, "~")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
