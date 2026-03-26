import { useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import { formatThinking } from "../ai/formatter";

const encoder = new TextEncoder();

/** Global shift key state tracker */
const shiftState = { held: false };
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { if (e.key === "Shift") shiftState.held = true; });
  window.addEventListener("keyup", (e) => { if (e.key === "Shift") shiftState.held = false; });
}

// ═══════════════════════════════════════════════════════════════
// SHELL COMMAND DATABASE — if first token matches, it's shell.
// ═══════════════════════════════════════════════════════════════
const SHELL_COMMANDS = new Set([
  // filesystem
  "ls", "cd", "pwd", "mkdir", "rmdir", "rm", "cp", "mv", "touch", "cat",
  "head", "tail", "less", "more", "find", "locate", "tree", "du", "df",
  "ln", "chmod", "chown", "chgrp", "stat", "file", "wc",
  // text
  "grep", "sed", "awk", "sort", "uniq", "cut", "tr", "diff", "patch",
  "echo", "printf", "tee", "xargs",
  // system
  "ps", "top", "htop", "kill", "killall", "bg", "fg", "jobs", "nohup",
  "sudo", "su", "whoami", "id", "uname", "hostname", "uptime", "env",
  "export", "source", "which", "type", "alias", "unalias", "history",
  // network
  "curl", "wget", "ssh", "scp", "rsync", "ping", "traceroute", "dig",
  "nslookup", "nc", "netstat", "lsof", "ifconfig", "ip",
  // package managers
  "brew", "apt", "yum", "dnf", "pacman", "pip", "pip3", "gem",
  "npm", "npx", "pnpm", "yarn", "bun", "deno", "node",
  // dev tools
  "git", "gh", "cargo", "rustc", "rustup", "go", "python", "python3",
  "ruby", "java", "javac", "make", "cmake", "gcc", "g++", "clang",
  "docker", "kubectl", "terraform", "ansible",
  // editors
  "vim", "nvim", "nano", "vi", "emacs", "code",
  // tauri / rust specific
  "tauri", "wasm-pack", "trunk",
  // shell builtins
  "exit", "clear", "reset", "true", "false", "test", "set", "unset",
  "read", "eval", "exec", "wait", "trap",
  // orellius tools
  "claude", "ollama", "cortex",
  // misc
  "man", "info", "help", "date", "cal", "bc", "yes", "sleep",
  "open", "pbcopy", "pbpaste", "osascript", "say", "caffeinate",
  "tar", "zip", "unzip", "gzip", "gunzip", "xz",
  "sips", "defaults", "launchctl", "diskutil", "hdiutil",
]);

// Patterns that are definitely shell (regex-like checks)
const SHELL_PATTERNS = [
  /^\.\//, // ./script
  /^\//, // /absolute/path
  /^~\//, // ~/relative
  /^\$/, // $VARIABLE
  /^[A-Z_]+=/, // ENV=value
  /^\(/, // subshell
  /^{/, // brace expansion
  /^!/, // history expansion
];

// Natural language signals — if these appear, likely AI query
const AI_SIGNALS = [
  "explain", "what is", "what are", "how do", "how does", "how to",
  "why is", "why does", "why did", "can you", "could you", "please",
  "help me", "tell me", "show me", "describe", "compare",
  "analyze", "summarize", "review", "suggest", "recommend",
  "write me", "create a", "build a", "make a", "generate",
  "fix this", "debug this", "refactor this", "optimize this",
  "what happened", "what went wrong", "is there",
];

/**
 * Smart detection: determines if input is a shell command or AI query.
 * Returns true if the input should go to AI, false for shell.
 */
function isAiQuery(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  // Force AI with explicit prefix (kept as escape hatch)
  if (trimmed.startsWith("#")) return true;

  // Force shell with ! prefix
  if (trimmed.startsWith("!")) return false;

  const lower = trimmed.toLowerCase();
  const firstToken = lower.split(/\s+/)[0] ?? "";

  // Known shell command → definitely shell
  if (SHELL_COMMANDS.has(firstToken)) return false;

  // Shell patterns (paths, variables, subshells)
  for (const pattern of SHELL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Contains pipe, redirect, semicolon → shell
  if (/[|><;]/.test(trimmed)) return false;

  // Contains && or || → shell
  if (trimmed.includes("&&") || trimmed.includes("||")) return false;

  // Contains ? → almost certainly AI (shell commands don't end with ?)
  if (trimmed.includes("?")) return true;

  // Greetings → AI
  const greetings = ["hi", "hey", "hello", "yo", "sup", "thanks", "thank", "please", "sorry"];
  if (greetings.includes(firstToken)) return true;

  // AI signals in the text → definitely AI
  for (const signal of AI_SIGNALS) {
    if (lower.includes(signal)) return true;
  }

  // Starts with a question word → AI
  const questionWords = [
    "what", "why", "how", "where", "when", "who", "whom", "whose",
    "which", "is", "are", "can", "could", "should", "would",
    "do", "does", "did", "will", "shall", "may", "might",
  ];
  if (questionWords.includes(firstToken)) return true;

  // First token not a known command AND not a path → likely AI
  if (!SHELL_COMMANDS.has(firstToken) && /^[a-z]/.test(firstToken)) {
    const wordCount = trimmed.split(/\s+/).length;
    // 3+ words that don't start with a command → AI
    if (wordCount >= 3) return true;
  }

  // Long input (>5 words) with no command match → likely AI
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 5) return true;

  // Default: shell (safe fallback — never eat a command)
  return false;
}

/**
 * Smart AI input layer — always-on, no prefix needed.
 * Every keystroke passes through to PTY normally.
 * On Enter: checks full line — shell command → PTY, natural language → AI.
 */
export function useAiInput(
  paneId: string,
  terminalRef: React.RefObject<Terminal | null>
) {
  const lineBuffer = useRef("");

  const handleData = useCallback(
    (data: string) => {
      const term = terminalRef.current;
      if (!term) return;

      for (const char of data) {
        const code = char.charCodeAt(0);

        // Enter — check if Shift is held for newline
        if (char === "\r" || char === "\n") {
          if (shiftState.held) {
            // Shift+Enter → add newline to buffer, pass to PTY for visual
            lineBuffer.current += "\n";
            invoke("write_pty", {
              paneId,
              data: Array.from(encoder.encode("\r")),
            }).catch(() => {});
            shiftState.held = false;
            return;
          }

          const line = lineBuffer.current.trim();

          if (line.length > 0 && isAiQuery(line)) {
            // Strip # prefix if used as explicit trigger
            const query = line.startsWith("#") ? line.slice(1).trim() : line;

            // Visual newline ONLY — do NOT send to PTY (would execute as shell command)
            term.write("\r\n");

            // Show thinking indicator immediately
            const provider = detectProvider(query);
            term.write(formatThinking(provider));

            // Send to AI
            invoke("send_ai_query", {
              query,
              paneId,
            }).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              term.write(`\r\n\x1b[31merror: ${msg}\x1b[0m\r\n`);
            });

            lineBuffer.current = "";
            return;
          }

          // Shell command — pass Enter to PTY normally
          lineBuffer.current = "";
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // Backspace — update buffer
        if (code === 127 || code === 8) {
          lineBuffer.current = lineBuffer.current.slice(0, -1);
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // Ctrl+C — reset buffer
        if (code === 3) {
          lineBuffer.current = "";
          invoke("write_pty", {
            paneId,
            data: Array.from(encoder.encode(data)),
          }).catch(() => {});
          return;
        }

        // Any other character — buffer AND pass to PTY (user sees normal typing)
        if (code >= 32) { // printable
          lineBuffer.current += char;
        }
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

  const codeWords = ["implement", "build", "fix", "debug", "refactor", "deploy", "write code", "create file"];
  for (const w of codeWords) {
    if (lower.includes(w)) return "claude";
  }
  const researchWords = ["explain", "compare", "what is", "how does", "analyze", "research", "find"];
  for (const w of researchWords) {
    if (lower.includes(w)) return "gemini";
  }
  return "ollama";
}
