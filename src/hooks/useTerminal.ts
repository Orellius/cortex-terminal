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
}

export function useTerminal(
  cwd: string,
  setCwd: (cwd: string) => void
): TerminalRefs {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    if (!cwd) return; // wait for home dir to resolve
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
      theme: TERMINAL_THEME,
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.open(el);

    requestAnimationFrame(() => {
      fit.fit();
      term.focus();
    });

    terminalRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    // Keystroke forwarding
    const dataDisposable = term.onData((data) => {
      invoke("write_pty", {
        paneId: "main",
        data: Array.from(encoder.encode(data)),
      }).catch(() => {});
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
        "pty:output:main",
        (e) => {
          const t = terminalRef.current;
          if (!t) return;
          t.write(new Uint8Array(e.payload.data));
        }
      );
      if (disposed) { unlistenOutput(); return; }

      unlistenExit = await listen<PtyExitPayload>("pty:exit:main", () => {
        terminalRef.current?.write(
          "\r\n\x1b[38;5;241m[process exited]\x1b[0m\r\n"
        );
      });
      if (disposed) { unlistenExit(); return; }

      await invoke("kill_pty", { paneId: "main" }).catch(() => {});
      try {
        await invoke("spawn_pty", { paneId: "main", cwd });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { termRef, terminalRef, searchRef, fitRef };
}
