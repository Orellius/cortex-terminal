import type { JSX } from "react";
import type { Tab } from "../types";
import { useAiTerminal } from "../hooks/useAiTerminal";

interface AiTabTerminalProps {
  tab: Tab;
  isActive: boolean;
}

export function AiTabTerminal({
  tab,
  isActive,
}: AiTabTerminalProps): JSX.Element {
  const { termRef } = useAiTerminal(tab.id, isActive);

  return (
    <div
      style={{
        display: isActive ? "flex" : "none",
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
      }}
    >
      <div
        ref={termRef}
        style={{
          flex: 1,
          minHeight: 0,
        }}
      />
    </div>
  );
}
