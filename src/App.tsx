import {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface PtyOutputPayload {
  pane_id: string;
  data: number[];
}

interface PtyExitPayload {
  pane_id: string;
}

interface ClaudeUsage {
  session_pct: number;
  weekly_pct: number;
  session_resets: string;
  weekly_resets: string;
}

interface ProjectEntry {
  name: string;
  path: string;
}

const encoder = new TextEncoder();
const TITLE_BAR_HEIGHT = "1.75rem";   // 28px
const STATUS_BAR_HEIGHT = "1.75rem";  // 28px

// ---------------------------------------------------------------------------
// Project Launcher Modal
// ---------------------------------------------------------------------------

interface LauncherProps {
  projects: ProjectEntry[];
  onSelect: (project: ProjectEntry) => void;
  onClose: () => void;
}

function ProjectLauncher({ projects, onSelect, onClose }: LauncherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  // Clamp selectedIndex when the filtered list shrinks.
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
    const item = listRef.current.children[clampedIndex] as HTMLElement | undefined;
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
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            flex: 1,
          }}
        >
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
            filtered.map((project, idx) => {
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

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [cwd, setCwd] = useState("/Users/orelohayon");
  const [branch, setBranch] = useState("—");
  const [usage, setUsage] = useState<ClaudeUsage>({
    session_pct: 0, weekly_pct: 0, session_resets: "—", weekly_resets: "—",
  });

  // Launcher state
  const [showLauncher, setShowLauncher] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  // -------------------------------------------------------------------------
  // Terminal setup
  // -------------------------------------------------------------------------

  useEffect(() => {
    const el = termRef.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily: '"Geist Mono", Menlo, monospace',
      fontSize: 13,
      letterSpacing: 0,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2, // xterm uses px internally — cannot use rem here
      cursorInactiveStyle: "outline",
      scrollback: 5000,
      allowProposedApi: true,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      theme: {
        background: "#09090b",
        foreground: "#d4d4d8",
        cursor: "#05a0ef",
        cursorAccent: "#09090b",
        selectionBackground: "rgba(5, 160, 239, 0.25)",
        selectionForeground: "#fafafa",
        selectionInactiveBackground: "rgba(255, 255, 255, 0.08)",
        black: "#3f3f46",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#d4d4d8",
        brightBlack: "#52525b",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#fafafa",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);

    requestAnimationFrame(() => {
      fit.fit();
      term.focus();
    });

    terminalRef.current = term;
    fitRef.current = fit;

    // Keystroke forwarding
    const dataDisposable = term.onData((data) => {
      invoke("write_pty", {
        paneId: "main",
        data: Array.from(encoder.encode(data)),
      }).catch(() => {});
    });

    // Track title changes (cwd from shell)
    const titleDisposable = term.onTitleChange((title) => {
      setCwd(title);
    });

    // PTY setup
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let disposed = false;

    (async () => {
      if (disposed) return;

      unlistenOutput = await listen<PtyOutputPayload>(
        "pty:output:main",
        (e) => {
          const t = terminalRef.current;
          if (!t) return;
          t.write(new Uint8Array(e.payload.data));
        }
      );
      if (disposed) { unlistenOutput(); return; }

      unlistenExit = await listen<PtyExitPayload>(
        "pty:exit:main",
        () => {
          terminalRef.current?.write(
            "\r\n\x1b[38;5;241m[process exited]\x1b[0m\r\n"
          );
        }
      );
      if (disposed) { unlistenExit(); return; }

      await invoke("kill_pty", { paneId: "main" }).catch(() => {});
      try {
        await invoke("spawn_pty", { paneId: "main", cwd: "/Users/orelohayon" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        term.write(`\x1b[31mpty error: ${msg}\x1b[0m\r\n`);
      }
    })();

    // Resize handling
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const f = fitRef.current;
        const t = terminalRef.current;
        if (!f || !t) return;
        try {
          f.fit();
          invoke("resize_pty", {
            paneId: "main",
            cols: t.cols,
            rows: t.rows,
          }).catch(() => {});
        } catch {
          // ignore during teardown
        }
      });
    });
    observer.observe(el);

    return () => {
      disposed = true;
      observer.disconnect();
      dataDisposable.dispose();
      titleDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      invoke("kill_pty", { paneId: "main" }).catch(() => {});
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Status polling
  // -------------------------------------------------------------------------

  const pollStatus = useCallback(async () => {
    try {
      const b = await invoke<string>("get_git_branch", { cwd: "/Users/orelohayon" });
      setBranch(b);
    } catch { setBranch("—"); }
    try {
      const u = await invoke<ClaudeUsage>("get_claude_usage");
      setUsage(u);
    } catch { /* keep last known */ }
  }, []);

  useEffect(() => {
    pollStatus();
    const id = setInterval(pollStatus, 10_000);
    return () => clearInterval(id);
  }, [pollStatus]);

  // -------------------------------------------------------------------------
  // Cmd+K launcher
  // -------------------------------------------------------------------------

  const openLauncher = useCallback(async () => {
    try {
      const result = await invoke<ProjectEntry[]>("list_projects");
      setProjects(result);
    } catch {
      setProjects([]);
    }
    setShowLauncher(true);
  }, []);

  const closeLauncher = useCallback(() => {
    setShowLauncher(false);
  }, []);

  const selectProject = useCallback(async (project: ProjectEntry) => {
    setShowLauncher(false);
    setCwd(project.path);

    // Kill existing PTY and spawn a new one in the selected directory.
    await invoke("kill_pty", { paneId: "main" }).catch(() => {});
    try {
      await invoke("spawn_pty", { paneId: "main", cwd: project.path });
      // Clear the terminal and print a separator so the user knows context changed.
      terminalRef.current?.clear();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      terminalRef.current?.write(`\x1b[31mpty error: ${msg}\x1b[0m\r\n`);
    }

    // Return focus to the terminal after navigation.
    requestAnimationFrame(() => {
      terminalRef.current?.focus();
    });
  }, []);

  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        if (showLauncher) {
          closeLauncher();
        } else {
          openLauncher();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showLauncher, openLauncher, closeLauncher]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  const shortPath = cwd.replace("/Users/orelohayon", "~") || "~";

  const usageColor = (pct: number): string => {
    if (pct >= 80) return "#f43f5e";
    if (pct >= 50) return "#f59e0b";
    return "#52525b";
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#09090b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Title bar — draggable, macOS traffic lights sit here */}
      <div
        data-tauri-drag-region=""
        style={{
          height: TITLE_BAR_HEIGHT,
          minHeight: TITLE_BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: "0.6875rem",
            color: "#71717a",
            letterSpacing: "0.01em",
          }}
        >
          {shortPath}
        </span>
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        onClick={() => terminalRef.current?.focus()}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: "0 0.5rem",
        }}
      />

      {/* Status bar */}
      <div
        style={{
          height: STATUS_BAR_HEIGHT,
          minHeight: STATUS_BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "0 0.75rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.04)",
          background: "#09090b",
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.6875rem",
          color: "#3f3f46",
          userSelect: "none",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {/* Left: branch */}
        <span style={{ color: "#52525b" }}>
          {branch !== "—" ? `${branch}` : ""}
        </span>

        {/* Cmd+K hint */}
        <span
          onClick={openLauncher}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            color: "#52525b",
            fontSize: "0.625rem",
            cursor: "pointer",
            transition: "border-color 120ms ease, color 120ms ease",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
            e.currentTarget.style.color = "#71717a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.color = "#52525b";
          }}
        >
          <span style={{ fontSize: "0.5625rem" }}>&#8984;</span>K
        </span>

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Right: usage */}
        <span>
          session{" "}
          <span style={{ color: usageColor(usage.session_pct) }}>
            {Math.round(usage.session_pct)}%
          </span>
        </span>
        <span>
          weekly{" "}
          <span style={{ color: usageColor(usage.weekly_pct) }}>
            {Math.round(usage.weekly_pct)}%
          </span>
        </span>
        <span style={{ color: "#3f3f46" }}>zsh</span>
      </div>

      {/* Cmd+K project launcher */}
      {showLauncher && (
        <ProjectLauncher
          projects={projects}
          onSelect={selectProject}
          onClose={closeLauncher}
        />
      )}
    </div>
  );
}
