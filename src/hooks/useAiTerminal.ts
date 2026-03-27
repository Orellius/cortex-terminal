import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TERMINAL_THEME } from "../constants";
import { formatAiResponse } from "../ai/formatter";
import { startThinking } from "../ai/thinking";
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
  const conversationId = useRef<string | null>(null);
  const thinkingAnim = useRef<{ stop: () => void } | null>(null);

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

    // Create or resume conversation
    invoke<string>("create_conversation", { tabId: paneId })
      .then((id) => { conversationId.current = id; })
      .catch(() => {});

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
          thinkingAnim.current?.stop();
          thinkingAnim.current = startThinking(term, provider);

          // Persist user message
          if (conversationId.current) {
            invoke("add_message", {
              msg: {
                conversation_id: conversationId.current,
                role: "user",
                content: line,
                provider: null,
                model: null,
                cost_usd: 0,
                duration_ms: 0,
                verified: true,
                created_at: new Date().toISOString(),
              },
            }).catch(() => {});
          }

          invoke("send_ai_query", { query: line, paneId }).catch(
            (err: unknown) => {
              thinkingAnim.current?.stop();
              thinkingAnim.current = null;
              const msg = err instanceof Error ? err.message : String(err);
              term.write(`\x1b[31merror: ${msg}${RESET}\r\n`);
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
        thinkingAnim.current?.stop();
        thinkingAnim.current = null;
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

        // Persist assistant response
        if (conversationId.current) {
          invoke("add_message", {
            msg: {
              conversation_id: conversationId.current,
              role: "assistant",
              content: d.chunk,
              provider: d.provider,
              model: d.model,
              cost_usd: d.cost,
              duration_ms: d.duration_ms,
              verified: d.verified,
              created_at: new Date().toISOString(),
            },
          }).catch(() => {});
        }
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
      thinkingAnim.current?.stop();
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
  // Dimmed divider line + prompt on new line (Claude CLI style)
  const cols = term.cols || 80;
  const divider = "─".repeat(Math.min(cols, 120));
  term.write(`\x1b[2m${divider}\x1b[0m\r\n`);
  term.write(`\x1b[2m>\x1b[0m `);
}

function detectProvider(query: string): string {
  const lower = query.toLowerCase();
  if (lower.startsWith("claude:") || lower.startsWith("c:")) return "claude";
  if (lower.startsWith("gemini:") || lower.startsWith("g:")) return "gemini";
  if (lower.startsWith("local:") || lower.startsWith("l:")) return "local";

  const words = lower.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, ""));

  // Code signals — any single match → Claude
  const codeWords = [
    "implement", "build", "fix", "debug", "refactor", "deploy", "publish",
    "commit", "compile", "migration", "scaffold", "architect", "optimize",
  ];
  if (codeWords.some((kw) => words.includes(kw))) return "claude";

  // Code context words — also route to Claude
  const codeCtx = [
    "bug", "error", "crash", "feature", "function", "component", "endpoint",
    "api", "route", "schema", "test", "cargo", "npm", "git", "rust", "typescript",
  ];
  if (codeCtx.some((kw) => words.includes(kw))) return "claude";

  // Code syntax → Claude
  if (/```|fn |function |class |import |async |struct |pub |const /.test(lower)) return "claude";
  if (/\.(rs|ts|tsx|js|py|toml)\b/.test(lower)) return "claude";

  // Research signals → Gemini
  const researchWords = [
    "explain", "compare", "analyze", "research", "summarize",
    "alternative", "competitor", "trend", "review", "difference",
  ];
  if (researchWords.some((kw) => words.includes(kw))) return "gemini";
  if (/what is|how does|how to|pros and cons|difference between/.test(lower)) return "gemini";

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
