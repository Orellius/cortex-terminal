import { PROVIDER_COLORS, RESET, BOLD, DIM } from "./constants";

export interface FormatOptions {
  readonly provider: string;
  readonly model: string;
  readonly content: string;
  readonly cost: number;
  readonly durationMs: number;
  readonly verified: boolean;
}

/** Model display names */
const MODEL_DISPLAY: Record<string, string> = {
  "nemotron-cascade-2": "Nemotron Cascade 2",
  "nemotron-3-nano:4b": "Nemotron 3 Nano 4B",
  "nemotron-3-nano:30b": "Nemotron 3 Nano 30B",
  "qwen2.5-coder:32b": "Qwen 2.5 Coder 32B",
  "dolphin-llama3:8b": "Dolphin Llama3 8B",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "sonnet": "Claude Sonnet",
  "haiku": "Claude Haiku",
  "opus": "Claude Opus",
};

/** Provider icons */
const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

/**
 * Format an AI response for terminal display (Claude CLI style).
 * Multi-line with basic ANSI markdown rendering + stats footer.
 */
export function formatAiResponse(opts: FormatOptions): string {
  const color = PROVIDER_COLORS[opts.provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[opts.provider] ?? "○";
  const displayName = MODEL_DISPLAY[opts.model] ?? opts.model;
  const costStr = opts.cost > 0 ? `$${opts.cost.toFixed(4)}` : "$0";
  const duration = (opts.durationMs / 1000).toFixed(1);
  const tokenEst = Math.round(opts.content.length / 4);

  const cleaned = stripThinkTags(opts.content);
  const rendered = renderAnsiMarkdown(cleaned);

  // Provider badge
  const badge = `${color}${icon} ${displayName}${RESET}`;

  // Response body — preserve line breaks
  const body = rendered
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\r\n");

  // Stats footer
  const stats = `${DIM}${costStr} · ~${tokenEst} tokens · ${duration}s${RESET}`;
  const verification = opts.verified ? "" : ` ${DIM}\x1b[33m[unverified]${RESET}`;

  return `${badge}${verification}\r\n${body}\r\n\r\n${stats}\r\n`;
}

/**
 * Basic ANSI markdown rendering for terminal.
 * Handles: **bold**, `inline code`, ```code blocks```, headers.
 */
function renderAnsiMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Code block toggle
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        const lang = line.trim().slice(3).trim();
        result.push(lang ? `${DIM}  ${lang}${RESET}` : "");
      }
      continue;
    }

    if (inCodeBlock) {
      // Code block content — dim + monospace look
      result.push(`${DIM}  ${line}${RESET}`);
      continue;
    }

    let processed = line;

    // Headers: # → bold
    if (/^#{1,3}\s/.test(processed)) {
      processed = processed.replace(/^#{1,3}\s+/, "");
      processed = `${BOLD}${processed}${RESET}`;
    }

    // **bold** → ANSI bold
    processed = processed.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);

    // `inline code` → dim
    processed = processed.replace(/`([^`]+)`/g, `${DIM}$1${RESET}`);

    // - bullet points → keep with bullet
    if (/^\s*[-*]\s/.test(processed)) {
      processed = processed.replace(/^(\s*)[-*]\s/, "$1- ");
    }

    result.push(processed);
  }

  return result.join("\n");
}

/** Strip ALL thinking/reasoning blocks from model output */
export function stripThinkTags(content: string): string {
  let result = content;

  // Strip <think>...</think> (with content)
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Strip unclosed <think>... (thinking at end, no close tag)
  result = result.replace(/<think>[\s\S]*/gi, "");

  // Strip everything BEFORE </think> (thinking at start, no open tag)
  const closeIdx = result.indexOf("</think>");
  if (closeIdx !== -1) {
    result = result.substring(closeIdx + "</think>".length);
  }

  // Also strip <quote>, </quote> and similar tags
  result = result.replace(/<\/?quote>/gi, "");
  result = result.replace(/<\/?output>/gi, "");
  result = result.replace(/<\/?response>/gi, "");
  result = result.replace(/<\/?answer>/gi, "");

  // Clean up whitespace
  result = result.replace(/^\n+/, "");
  return result.trim();
}

/** Format a "thinking" indicator with model name (static version for non-animated contexts) */
export function formatThinking(provider: string): string {
  const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[provider] ?? "○";
  return `${color}${BOLD}${icon}${RESET} ${DIM}thinking...${RESET}`;
}

/** Format a budget cap warning */
export function formatBudgetCap(): string {
  return `\r\n\x1b[33m${BOLD}⚠ budget${RESET} ${DIM}daily limit reached — local models only${RESET}\r\n`;
}
