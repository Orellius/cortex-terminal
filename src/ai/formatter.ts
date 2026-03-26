import { PROVIDER_COLORS, PROVIDER_LABELS, RESET, BOLD, DIM } from "./constants";

interface FormatOptions {
  readonly provider: string;
  readonly model: string;
  readonly content: string;
  readonly cost: number;
  readonly durationMs: number;
  readonly verified: boolean;
}

/** Format an AI response for inline terminal display using ANSI escape codes. */
export function formatAiResponse(opts: FormatOptions): string {
  const color = PROVIDER_COLORS[opts.provider] ?? "\x1b[37m";
  const label = PROVIDER_LABELS[opts.provider] ?? opts.provider;
  const costStr = opts.cost > 0 ? `$${opts.cost.toFixed(4)}` : "$0";
  const duration = (opts.durationMs / 1000).toFixed(1);
  const verifyBadge = opts.verified ? "" : ` ${DIM}[unverified]${RESET}`;

  // Strip <think>...</think> blocks from model output
  const cleaned = stripThinkTags(opts.content);

  const lines: string[] = [];

  // Header: provider badge
  lines.push("");
  lines.push(`${color}${BOLD} ${label} ${RESET} ${DIM}${opts.model}${RESET}${verifyBadge}`);
  lines.push(`${DIM}${"─".repeat(60)}${RESET}`);

  // Content — cleaned of thinking tags
  const contentLines = cleaned.trimEnd().split("\n");
  for (const line of contentLines) {
    lines.push(line);
  }

  // Footer: cost + duration
  lines.push(`${DIM}${"─".repeat(60)}${RESET}`);
  lines.push(`${DIM} ${costStr}  ${duration}s${RESET}`);
  lines.push("");

  return lines.join("\r\n");
}

/** Strip <think>...</think> reasoning blocks from model output.
 *  Nemotron-Cascade-2 and similar models wrap reasoning in these tags. */
function stripThinkTags(content: string): string {
  // Remove everything between <think> and </think> (including tags)
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Also handle unclosed <think> (model still thinking at output end)
  result = result.replace(/<think>[\s\S]*/gi, "");
  // Clean up extra leading newlines from removal
  result = result.replace(/^\n+/, "");
  return result.trim();
}

/** Format a "thinking" indicator */
export function formatThinking(provider: string): string {
  const color = PROVIDER_COLORS[provider] ?? "\x1b[37m";
  const label = PROVIDER_LABELS[provider] ?? provider;
  return `\r\n${color}${BOLD} ${label} ${RESET} ${DIM}thinking...${RESET}`;
}

/** Format a budget cap warning */
export function formatBudgetCap(): string {
  return `\r\n\x1b[33m${BOLD} budget ${RESET} ${DIM}daily limit reached — local models only${RESET}\r\n`;
}
