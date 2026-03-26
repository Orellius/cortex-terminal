import { PROVIDER_COLORS, RESET, BOLD, DIM } from "./constants";

interface FormatOptions {
  readonly provider: string;
  readonly model: string;
  readonly content: string;
  readonly cost: number;
  readonly durationMs: number;
  readonly verified: boolean;
}

/** Model display names with provider context */
const MODEL_DISPLAY: Record<string, string> = {
  "nemotron-cascade-2": "Nemotron Cascade 2",
  "qwen2.5-coder:32b": "Qwen 2.5 Coder 32B",
  "dolphin-llama3:8b": "Dolphin Llama3 8B",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "sonnet": "Claude Sonnet",
  "haiku": "Claude Haiku",
  "opus": "Claude Opus",
};

/** Provider type labels */
const PROVIDER_TYPE: Record<string, string> = {
  claude: "Cloud",
  gemini: "Free",
  ollama: "Local",
};

/** Provider icons (unicode) */
const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

/** Format an AI response for inline terminal display */
export function formatAiResponse(opts: FormatOptions): string {
  const color = PROVIDER_COLORS[opts.provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[opts.provider] ?? "○";
  const displayName = MODEL_DISPLAY[opts.model] ?? opts.model;
  const providerType = PROVIDER_TYPE[opts.provider] ?? "";
  const costStr = opts.cost > 0 ? `$${opts.cost.toFixed(4)}` : "$0";
  const duration = (opts.durationMs / 1000).toFixed(1);
  const verifyTag = opts.verified ? "" : ` ${DIM}⚠ unverified${RESET}`;

  const cleaned = stripThinkTags(opts.content);

  const lines: string[] = [];

  // Header: [icon] Model Name — Provider Type
  lines.push("");
  lines.push(`${color}${BOLD}${icon} ${displayName}${RESET} ${DIM}— ${providerType}${RESET}${verifyTag}`);
  lines.push(`${DIM}${"─".repeat(60)}${RESET}`);

  // Content
  const contentLines = cleaned.trimEnd().split("\n");
  for (const line of contentLines) {
    lines.push(line);
  }

  // Footer: cost · duration
  lines.push(`${DIM}${"─".repeat(60)}${RESET}`);
  lines.push(`${DIM}${costStr} · ${duration}s${RESET}`);
  lines.push("");

  return lines.join("\r\n");
}

/** Strip ALL thinking/reasoning blocks from model output.
 *  Handles: <think>...</think>, unclosed <think>, </think> without opener,
 *  and any other XML-like reasoning tags models might emit. */
function stripThinkTags(content: string): string {
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

/** Format a "thinking" indicator with model name */
export function formatThinking(provider: string): string {
  const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
  const icon = PROVIDER_ICON[provider] ?? "○";
  return `\r\n${color}${BOLD}${icon}${RESET} ${DIM}thinking...${RESET}`;
}

/** Format a budget cap warning */
export function formatBudgetCap(): string {
  return `\r\n\x1b[33m${BOLD}⚠ budget${RESET} ${DIM}daily limit reached — local models only${RESET}\r\n`;
}
