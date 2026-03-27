import type { Terminal } from "@xterm/xterm";
import { PROVIDER_COLORS, RESET, DIM } from "./constants";

/** Braille spinner frames (Claude CLI style) */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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
    "scanning for patterns",
    "validating approach",
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
    "scanning references",
    "verifying facts",
  ],
  ollama: [
    "processing locally",
    "running inference",
    "generating tokens",
    "computing attention",
    "decoding response",
    "evaluating probabilities",
    "traversing context",
    "applying reasoning chain",
    "optimizing output",
    "finalizing response",
    "activating experts",
    "routing through MoE",
  ],
};

const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

export interface ThinkingAnimation {
  stop: () => { elapsedMs: number };
}

/**
 * Start an animated thinking indicator on the current terminal line.
 * Braille spinner + rotating status text + elapsed timer.
 * Returns a handle to stop the animation.
 */
export function startThinking(
  term: Terminal,
  provider: string,
): ThinkingAnimation {
  const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[provider] ?? "○";
  const lines = THINKING_LINES[provider] ?? THINKING_LINES.ollama;
  const startTime = Date.now();

  let frame = 0;
  let lineIndex = 0;
  let stopped = false;

  // Shuffle lines for variety
  const shuffled = [...lines].sort(() => Math.random() - 0.5);

  // Change status text every ~3 spinner frames (slower rotation than spinner)
  const TEXT_CHANGE_INTERVAL = 3;

  const render = (): void => {
    if (stopped) return;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const spinner = SPINNER[frame % SPINNER.length];
    const statusText = shuffled[lineIndex % shuffled.length];

    term.write(
      `\x1b[2K\r${color}${spinner}${RESET} ` +
      `${color}${icon}${RESET} ` +
      `${DIM}${statusText}${RESET}` +
      `  ${DIM}${elapsed}s${RESET}`
    );

    frame++;
    if (frame % TEXT_CHANGE_INTERVAL === 0) {
      lineIndex++;
    }
  };

  // Initial render
  render();

  // Spinner ticks every 100ms (fast spin), text changes every ~300ms
  const interval = setInterval(render, 100);

  return {
    stop(): { elapsedMs: number } {
      stopped = true;
      clearInterval(interval);
      const elapsedMs = Date.now() - startTime;
      // Clear the thinking line
      term.write("\x1b[2K\r");
      return { elapsedMs };
    },
  };
}
