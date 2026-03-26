export const TITLE_BAR_HEIGHT = "2.25rem";
export const TAB_BAR_HEIGHT = "2rem";
export const STATUS_BAR_HEIGHT = "1.75rem";

export const TERMINAL_THEME = {
  background: "#09090b",
  foreground: "#e4e4e7",          // zinc-200 — brighter base text for readability
  cursor: "#05a0ef",
  cursorAccent: "#09090b",
  selectionBackground: "rgba(5, 160, 239, 0.2)",
  selectionForeground: "#fafafa",
  selectionInactiveBackground: "rgba(255, 255, 255, 0.06)",

  // Normal — softer, desaturated tones that read well on dark bg
  black: "#3f3f46",               // zinc-700 — visible on #09090b
  red: "#fb7185",                 // rose-400 — warm, not aggressive
  green: "#34d399",               // emerald-400 — easy on eyes
  yellow: "#fbbf24",              // amber-400 — warm gold, not neon
  blue: "#60a5fa",                // blue-400 — clear, calm
  magenta: "#a78bfa",             // violet-400 — muted purple
  cyan: "#22d3ee",                // cyan-400 — fresh
  white: "#e4e4e7",               // zinc-200 — matches foreground

  // Bright — slightly lifted for emphasis, not oversaturated
  brightBlack: "#71717a",         // zinc-500 — comments, dimmed text
  brightRed: "#fda4af",           // rose-300
  brightGreen: "#6ee7b7",         // emerald-300
  brightYellow: "#fde68a",        // amber-200
  brightBlue: "#93c5fd",          // blue-300
  brightMagenta: "#c4b5fd",       // violet-300
  brightCyan: "#67e8f9",          // cyan-300
  brightWhite: "#fafafa",         // zinc-50 — pure white for bold emphasis
} as const;
