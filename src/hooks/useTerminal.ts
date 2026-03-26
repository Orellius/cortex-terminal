import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { TERMINAL_THEME } from "../constants";
import type { PtyOutputPayload, PtyExitPayload } from "../types";

const encoder = new TextEncoder();

interface TerminalRefs {
  termRef: React.RefObject<HTMLDivElement | null>;
  terminalRef: React.RefObject<Terminal | null>;
  searchRef: React.RefObject<SearchAddon | null>;
  fitRef: React.RefObject<FitAddon | null>;
  aiHandlerRef: React.MutableRefObject<((data: string) => void) | null>;
}

export function useTerminal(
  cwd: string,
  setCwd: (cwd: string) => void,
  paneId: string,
  isActive: boolean
): TerminalRefs {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const aiHandlerRef = useRef<((data: string) => void) | null>(null);

  // Focus/blur the terminal when active state changes (after mount)
  useEffect(() => {
    if (!terminalRef.current) return;
    if (isActive) {
      requestAnimationFrame(() => {
        terminalRef.current?.focus();
      });
    } else {
      terminalRef.current.blur();
    }
  }, [isActive]);

  useEffect(() => {
    if (!cwd) return; // wait for home dir to resolve
    if (!paneId) return;
    const el = termRef.current;
    if (!el) return;

    // Derive terminal font size from the responsive root font-size (set via clamp() in CSS).
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    const termFontSize = Math.round(rootFontSize * 0.95);

    const term = new Terminal({
      fontFamily: '"Geist Mono", Menlo, monospace',
      fontSize: termFontSize,
      fontWeight: "400",
      fontWeightBold: "600",
      letterSpacing: 0.4,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      cursorInactiveStyle: "outline",
      scrollback: 5000,
      allowProposedApi: true,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      theme: TERMINAL_THEME,
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.open(el);

    requestAnimationFrame(() => {
      fit.fit();
      if (isActive) {
        term.focus();
      }
    });

    terminalRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    // Keystroke forwarding — AI input interception layer
    // When aiHandlerRef is set, keystrokes route through it (detects # prefix).
    // Otherwise, falls back to direct PTY write.
    const dataDisposable = term.onData((data) => {
      if (aiHandlerRef.current) {
        aiHandlerRef.current(data);
      } else {
        invoke("write_pty", {
          paneId,
          data: Array.from(encoder.encode(data)),
        }).catch(() => {});
      }
    });

    // Track title changes (cwd reported by shell via OSC)
    const titleDisposable = term.onTitleChange((title) => {
      setCwd(title);
    });

    // PTY lifecycle
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let disposed = false;

    (async () => {
      if (disposed) return;

      unlistenOutput = await listen<PtyOutputPayload>(
        `pty:output:${paneId}`,
        (e) => {
          const t = terminalRef.current;
          if (!t) return;
          t.write(new Uint8Array(e.payload.data));
        }
      );
      if (disposed) {
        unlistenOutput();
        return;
      }

      unlistenExit = await listen<PtyExitPayload>(
        `pty:exit:${paneId}`,
        () => {
          terminalRef.current?.write(
            "\r\n\x1b[38;5;241m[process exited]\x1b[0m\r\n"
          );
        }
      );
      if (disposed) {
        unlistenExit();
        return;
      }

      await invoke("kill_pty", { paneId }).catch(() => {});
      try {
        await invoke("spawn_pty", { paneId, cwd });
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
            paneId,
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
      invoke("kill_pty", { paneId }).catch(() => {});
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
    // Re-run when cwd changes from empty (initial) to resolved home dir.
    // Subsequent cwd changes (from Cmd+K) are handled by selectProject directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, paneId]);

  return { termRef, terminalRef, searchRef, fitRef, aiHandlerRef };
}
