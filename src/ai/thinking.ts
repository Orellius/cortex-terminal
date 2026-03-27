import type { Terminal } from "@xterm/xterm";
import { PROVIDER_COLORS, RESET, DIM } from "./constants";

/** Random thinking status messages — rotated during AI processing */
const THINKING_LINES: Record<string, string[]> = {
  claude: [
    "parsing code structure",
    "analyzing dependencies",
    "reasoning about implementation",
    "evaluating edge cases",
    "considering architectural patterns",
    "tracing execution flow",
    "reviewing type contracts",
    "mapping function signatures",
    "checking constraint satisfaction",
    "synthesizing solution",
  ],
  gemini: [
    "searching knowledge base",
    "cross-referencing sources",
    "evaluating perspectives",
    "synthesizing information",
    "analyzing context",
    "comparing alternatives",
    "gathering relevant data",
    "processing query semantics",
    "building response framework",
    "correlating findings",
  ],
  ollama: [
    "processing locally",
    "running inference",
    "generating tokens",
    "computing attention",
    "decoding response",
    "evaluating token probabilities",
    "traversing context window",
    "applying reasoning chain",
    "optimizing output quality",
    "finalizing response",
  ],
};

const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

interface ThinkingAnimation {
  stop: () => void;
}

/**
 * Start an animated thinking indicator on the current terminal line.
 * Returns a handle to stop the animation when the response arrives.
 *
 * The animation cycle:
 * - Provider icon + rotating status text
 * - Elapsed timer (0.0s, 0.1s, ...)
 * - Updates every 800ms with a new random line
 */
export function startThinking(
  term: Terminal,
  provider: string,
): ThinkingAnimation {
  const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[provider] ?? "○";
  const lines = THINKING_LINES[provider] ?? THINKING_LINES.ollama;
  const startTime = Date.now();

  let lineIndex = 0;
  let stopped = false;

  // Shuffle the lines for variety
  const shuffled = [...lines].sort(() => Math.random() - 0.5);

  const render = (): void => {
    if (stopped) return;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const statusText = shuffled[lineIndex % shuffled.length];

    // Erase current line, write new status
    term.write(
      `\x1b[2K\r${color}${icon}${RESET} ${DIM}${statusText}${RESET}` +
      `  ${DIM}${elapsed}s${RESET}`
    );

    lineIndex++;
  };

  // Initial render
  render();

  // Rotate every 800ms
  const interval = setInterval(render, 800);

  return {
    stop(): void {
      stopped = true;
      clearInterval(interval);
      // Clear the thinking line — caller writes the response
      term.write("\x1b[2K\r");
    },
  };
}
