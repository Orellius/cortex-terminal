import { useEffect, useRef } from "react";
import type { JSX } from "react";
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

interface TerminalPaneProps {
  paneId: string;
  cwd: string;
  isActive: boolean;
}

const encoder = new TextEncoder();

export function TerminalPane({
  paneId,
  cwd,
  isActive,
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: "Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: "block",
      theme: {
        background: "#09090b",
        foreground: "#a1a1aa",
        cursor: "#05a0ef",
        cursorAccent: "#09090b",
        selectionBackground: "rgba(5,160,239,0.3)",
        black: "#09090b",
        red: "#f43f5e",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#05a0ef",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#a1a1aa",
        brightBlack: "#71717a",
        brightRed: "#fb7185",
        brightGreen: "#34d399",
        brightYellow: "#fcd34d",
        brightBlue: "#38bdf8",
        brightMagenta: "#a78bfa",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    requestAnimationFrame(() => {
      fitAddon.fit();
      term.focus();
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    const dataDisposable = term.onData((data: string) => {
      const bytes = Array.from(encoder.encode(data));
      invoke("write_pty", { paneId, data: bytes }).catch(() => {});
    });

    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let disposed = false;

    async function setup(): Promise<void> {
      if (disposed) return;

      unlistenOutput = await listen<PtyOutputPayload>(
        `pty:output:${paneId}`,
        (e) => {
          const t = terminalRef.current;
          if (!t || e.payload.pane_id !== paneId) return;
          t.write(new Uint8Array(e.payload.data));
        }
      );

      if (disposed) { unlistenOutput(); return; }

      unlistenExit = await listen<PtyExitPayload>(
        `pty:exit:${paneId}`,
        (e) => {
          const t = terminalRef.current;
          if (!t || e.payload.pane_id !== paneId) return;
          t.write("\r\n\x1b[2m[Process exited]\x1b[0m\r\n");
        }
      );

      if (disposed) { unlistenExit(); return; }

      await invoke("kill_pty", { paneId }).catch(() => {});
      try {
        await invoke("spawn_pty", { paneId, cwd });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        term.write(`\x1b[31mFailed to spawn PTY: ${msg}\x1b[0m\r\n`);
      }
    }

    setup();

    return () => {
      disposed = true;
      dataDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      invoke("kill_pty", { paneId }).catch(() => {});
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, cwd]);

  useEffect(() => {
    if (isActive) {
      terminalRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver(() => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const fit = fitAddonRef.current;
        const term = terminalRef.current;
        if (!fit || !term) return;
        try {
          fit.fit();
          invoke("resize_pty", {
            paneId,
            cols: term.cols,
            rows: term.rows,
          }).catch(() => {});
        } catch {
          // fit() can throw if container has zero dimensions during unmount
        }
      }, 16);
    });

    observer.observe(container);
    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [paneId]);

  return (
    <div
      ref={containerRef}
      onClick={() => terminalRef.current?.focus()}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        borderTop: isActive
          ? "1px solid #05a0ef"
          : "1px solid rgba(255,255,255,0.05)",
      }}
    />
  );
}
