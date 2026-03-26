/** Provider visual identity */
export const PROVIDER_COLORS: Record<string, string> = {
  claude: "\x1b[35m",   // violet
  gemini: "\x1b[36m",   // cyan
  ollama: "\x1b[32m",   // green
};

export const PROVIDER_LABELS: Record<string, string> = {
  claude: "claude",
  gemini: "gemini",
  ollama: "local",
};

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const ITALIC = "\x1b[3m";

/** Box-drawing chars for AI response borders */
export const BOX = {
  top: "─",
  topLeft: "┌",
  topRight: "┐",
  bottom: "─",
  bottomLeft: "└",
  bottomRight: "┘",
  vertical: "│",
} as const;
