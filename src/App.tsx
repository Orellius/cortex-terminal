import { useEffect, useRef, useState, useCallback } from "react";
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

const encoder = new TextEncoder();
const TITLE_BAR_HEIGHT = "1.75rem";   // 28px
const STATUS_BAR_HEIGHT = "1.75rem";  // 28px

export function App() {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [cwd, setCwd] = useState("/Users/orelohayon");
  const [branch, setBranch] = useState("—");
  const [usage, setUsage] = useState<ClaudeUsage>({
    session_pct: 0, weekly_pct: 0, session_resets: "—", weekly_resets: "—",
  });

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

  // Poll status data every 10s
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

  const shortPath = cwd.replace("/Users/orelohayon", "~") || "~";

  const usageColor = (pct: number): string => {
    if (pct >= 80) return "#f43f5e";
    if (pct >= 50) return "#f59e0b";
    return "#52525b";
  };

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
    </div>
  );
}
