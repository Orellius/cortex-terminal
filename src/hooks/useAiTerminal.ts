import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_THEME } from "../constants";
import { formatAiResponse, formatThinking } from "../ai/formatter";
import { RESET, BOLD, DIM } from "../ai/constants";

interface AiStreamEvent {
  pane_id: string;
  provider: string;
  model: string;
  chunk: string;
  done: boolean;
  cost: number;
  duration_ms: number;
  verified: boolean;
}

interface AiTerminalRefs {
  termRef: React.RefObject<HTMLDivElement | null>;
  terminalRef: React.RefObject<Terminal | null>;
  fitRef: React.RefObject<FitAddon | null>;
}

/**
 * AI Terminal — no PTY. Everything goes to AI ensemble.
 * `!command` runs a one-shot shell command via PTY.
 * xterm is used as the renderer for ANSI-formatted output.
 */
export function useAiTerminal(
  paneId: string,
  isActive: boolean
): AiTerminalRefs {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineBuffer = useRef("");

  useEffect(() => {
    if (!isActive) {
      terminalRef.current?.blur();
      return;
    }
    requestAnimationFrame(() => terminalRef.current?.focus());
  }, [isActive]);

  useEffect(() => {
    const el = termRef.current;
    if (!el) return;

    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );

    const term = new Terminal({
      fontFamily: '"Geist Mono", Menlo, monospace',
      fontSize: Math.round(rootFontSize * 0.95),
      fontWeight: "400",
      fontWeightBold: "600",
      letterSpacing: 0.4,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      scrollback: 10000,
      allowProposedApi: true,
      theme: TERMINAL_THEME,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);

    requestAnimationFrame(() => {
      fit.fit();
      if (isActive) term.focus();
    });

    terminalRef.current = term;
    fitRef.current = fit;

    // Welcome message
    term.write(`${BOLD}Cortex AI Terminal${RESET}\r\n`);
    term.write(`${DIM}Type naturally. Models route automatically.${RESET}\r\n`);
    term.write(`${DIM}Prefix ! for shell commands (e.g., !ls -la)${RESET}\r\n`);
    term.write(`\r\n`);
    writePrompt(term);

    // Input handling — everything goes to AI except !commands
    const dataDisposable = term.onData((data) => {
      for (const char of data) {
        const code = char.charCodeAt(0);

        // Enter
        if (char === "\r" || char === "\n") {
          const line = lineBuffer.current.trim();
          term.write("\r\n");

          if (line.length === 0) {
            writePrompt(term);
            lineBuffer.current = "";
            return;
          }

          // Shell command: !command
          if (line.startsWith("!")) {
            const cmd = line.slice(1).trim();
            if (cmd.length > 0) {
              executeShellCommand(cmd, term, paneId);
            } else {
              writePrompt(term);
            }
            lineBuffer.current = "";
            return;
          }

          // AI query — route to ensemble
          const provider = detectProvider(line);
          term.write(formatThinking(provider));

          invoke("send_ai_query", { query: line, paneId }).catch(
            (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              term.write(`\r\n\x1b[31merror: ${msg}${RESET}\r\n`);
              writePrompt(term);
            }
          );

          lineBuffer.current = "";
          return;
        }

        // Backspace
        if (code === 127 || code === 8) {
          if (lineBuffer.current.length > 0) {
            lineBuffer.current = lineBuffer.current.slice(0, -1);
            term.write("\b \b");
          }
          return;
        }

        // Ctrl+C — clear line
        if (code === 3) {
          lineBuffer.current = "";
          term.write("^C\r\n");
          writePrompt(term);
          return;
        }

        // Ctrl+L — clear screen
        if (code === 12) {
          term.clear();
          writePrompt(term);
          return;
        }

        // Printable character — echo and buffer
        if (code >= 32) {
          lineBuffer.current += char;
          term.write(char);
        }
      }
    });

    // AI stream listener
    let unlistenStream: (() => void) | undefined;
    listen<AiStreamEvent>("cortex:ai:stream", (event) => {
      const d = event.payload;
      if (d.pane_id !== paneId) return;
      if (d.done) {
        term.write("\x1b[2K\r"); // Clear thinking line
        const formatted = formatAiResponse({
          provider: d.provider,
          model: d.model,
          content: d.chunk,
          cost: d.cost,
          durationMs: d.duration_ms,
          verified: d.verified,
        });
        term.write(formatted);
        writePrompt(term);
      }
    }).then((fn) => { unlistenStream = fn; });

    // Resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try { fit.fit(); } catch { /* teardown */ }
      });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      unlistenStream?.();
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [paneId, isActive]);

  return { termRef, terminalRef, fitRef };
}

function writePrompt(term: Terminal): void {
  term.write(`\x1b[36mcortex\x1b[0m \x1b[2m>\x1b[0m `);
}

function detectProvider(query: string): string {
  const lower = query.toLowerCase();
  if (lower.startsWith("claude:") || lower.startsWith("c:")) return "claude";
  if (lower.startsWith("gemini:") || lower.startsWith("g:")) return "gemini";
  if (lower.startsWith("local:") || lower.startsWith("l:")) return "local";

  const codeWords = ["implement", "build", "fix", "debug", "refactor", "deploy", "write", "create"];
  for (const w of codeWords) { if (lower.includes(w)) return "claude"; }
  const researchWords = ["explain", "compare", "what", "how", "analyze", "research", "find"];
  for (const w of researchWords) { if (lower.includes(w)) return "gemini"; }
  return "ollama";
}

/** Run a one-shot shell command and display output in the AI terminal */
function executeShellCommand(cmd: string, term: Terminal, _paneId: string): void {
  term.write(`${DIM}$ ${cmd}${RESET}\r\n`);

  const tmpId = `shell-${Date.now()}`;

  invoke("spawn_pty", { paneId: tmpId, cwd: "~" }).then(() => {
    const encoded = Array.from(new TextEncoder().encode(cmd + "\n"));
    invoke("write_pty", { paneId: tmpId, data: encoded });

    setTimeout(() => {
      invoke("kill_pty", { paneId: tmpId }).catch(() => {});
      writePrompt(term);
    }, 3000);

    listen(`pty:output:${tmpId}`, (event: { payload: { data: number[] } }) => {
      const bytes = new Uint8Array(event.payload.data);
      term.write(bytes);
    });
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    term.write(`\x1b[31m${msg}${RESET}\r\n`);
    writePrompt(term);
  });
}
