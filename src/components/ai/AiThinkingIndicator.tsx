import { useState, useEffect, useRef, type JSX } from "react";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const THINKING_LINES: Record<string, string[]> = {
  claude: [
    "parsing code structure",
    "analyzing dependencies",
    "reasoning about implementation",
    "evaluating edge cases",
    "considering patterns",
    "tracing execution flow",
    "reviewing contracts",
    "mapping signatures",
    "checking constraints",
    "synthesizing solution",
  ],
  gemini: [
    "searching knowledge base",
    "cross-referencing sources",
    "evaluating perspectives",
    "synthesizing information",
    "analyzing context",
    "comparing alternatives",
    "gathering data",
    "processing semantics",
    "building framework",
    "correlating findings",
  ],
  ollama: [
    "processing locally",
    "running inference",
    "generating tokens",
    "computing attention",
    "decoding response",
    "evaluating probabilities",
    "traversing context",
    "applying reasoning",
    "activating experts",
    "routing through MoE",
  ],
};

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#8b5cf6",
  gemini: "#0ea5e9",
  ollama: "#10b981",
};

const PROVIDER_ICON: Record<string, string> = {
  claude: "◆",
  gemini: "◈",
  ollama: "●",
};

interface Props {
  provider: string;
  startTime: number;
}

export function AiThinkingIndicator({ provider, startTime }: Props): JSX.Element {
  const [frame, setFrame] = useState(0);
  const color = PROVIDER_COLORS[provider] ?? "#52525b";
  const icon = PROVIDER_ICON[provider] ?? "○";
  const lines = THINKING_LINES[provider] ?? THINKING_LINES.ollama;
  const shuffledRef = useRef([...lines].sort(() => Math.random() - 0.5));

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => f + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const spinner = SPINNER[frame % SPINNER.length];
  const textIndex = Math.floor(frame / 3);
  const statusText = shuffledRef.current[textIndex % shuffledRef.current.length];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.5rem 0",
        fontFamily: '"Geist Mono", Menlo, monospace',
        fontSize: "0.75rem",
      }}
    >
      <span style={{ color, fontSize: "0.875rem" }}>{spinner}</span>
      <span style={{ color, fontSize: "0.6875rem" }}>{icon}</span>
      <span style={{ color: "#52525b" }}>{statusText}</span>
      <span style={{ color: "#3f3f46", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
        {elapsed}s
      </span>
    </div>
  );
}
