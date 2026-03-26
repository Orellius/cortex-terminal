import { useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import { formatThinking } from "../ai/formatter";

const encoder = new TextEncoder();

/**
 * AI input interception layer.
 * Sits between xterm onData and PTY write.
 * Detects # prefix at line start, buffers the query, sends to AI on Enter.
 * Returns a wrapper function to use instead of direct PTY write.
 */
export function useAiInput(
  paneId: string,
  terminalRef: React.RefObject<Terminal | null>
) {
  const lineBuffer = useRef("");
  const isAiMode = useRef(false);
  const cursorPos = useRef(0);

  const handleData = useCallback(
    (data: string) => {
      const term = terminalRef.current;
      if (!term) return;

      // Check each character
      for (const char of data) {
        const code = char.charCodeAt(0);

        // Enter key
        if (char === "\r" || char === "\n") {
          if (isAiMode.current && lineBuffer.current.length > 0) {
            // Send to AI — strip the # prefix
            const query = lineBuffer.current;
            term.write("\r\n");

            // Show thinking indicator
            const provider = detectProvider(query);
            term.write(formatThinking(provider));

            // Fire-and-forget to Rust
            invoke("send_ai_query", {
              query,
              paneId,
            }).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              term.write(`\r\n\x1b[31merror: ${msg}\x1b[0m\r\n`);
            });

            lineBuffer.current = "";
            isAiMode.current = false;
            cursorPos.current = 0;
            return;
          }

          // Normal Enter — flush to PTY
          lineBuffer.current = "";
          isAiMode.current = false;
          cursorPos.current = 0;
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // Backspace
        if (code === 127 || code === 8) {
          if (isAiMode.current && lineBuffer.current.length > 0) {
            lineBuffer.current = lineBuffer.current.slice(0, -1);
            cursorPos.current = Math.max(0, cursorPos.current - 1);
            term.write("\b \b"); // Visual backspace
            // If we deleted the #, exit AI mode
            if (lineBuffer.current.length === 0) {
              isAiMode.current = false;
            }
            return;
          }
          // Normal backspace to PTY
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // Ctrl+C — cancel AI mode
        if (code === 3) {
          if (isAiMode.current) {
            lineBuffer.current = "";
            isAiMode.current = false;
            cursorPos.current = 0;
            term.write("^C\r\n");
            return;
          }
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // # at start of line — enter AI mode
        if (char === "#" && lineBuffer.current.length === 0 && !isAiMode.current) {
          isAiMode.current = true;
          lineBuffer.current = "";
          cursorPos.current = 0;
          term.write("\x1b[35m#\x1b[0m "); // Violet # prompt
          return;
        }

        // In AI mode — buffer and echo
        if (isAiMode.current) {
          lineBuffer.current += char;
          cursorPos.current += 1;
          term.write(char); // Echo locally
          return;
        }

        // Normal character — passthrough to PTY
        lineBuffer.current += char;
        cursorPos.current += 1;
        invoke("write_pty", {
          paneId,
          data: Array.from(encoder.encode(char)),
        }).catch(() => {});
      }
    },
    [paneId, terminalRef]
  );

  return handleData;
}

/** Detect which provider will handle this query (for thinking indicator) */
function detectProvider(query: string): string {
  const lower = query.toLowerCase();
  if (lower.startsWith("claude:") || lower.startsWith("c:")) return "claude";
  if (lower.startsWith("gemini:") || lower.startsWith("g:")) return "gemini";
  if (lower.startsWith("local:") || lower.startsWith("l:")) return "local";

  // Simple heuristic matching router.rs logic
  const codeWords = ["implement", "build", "fix", "debug", "refactor", "deploy", "cargo", "npm"];
  for (const w of codeWords) {
    if (lower.includes(w)) return "claude";
  }
  const researchWords = ["explain", "compare", "what is", "how does", "analyze", "research"];
  for (const w of researchWords) {
    if (lower.includes(w)) return "gemini";
  }
  return "ollama";
}
