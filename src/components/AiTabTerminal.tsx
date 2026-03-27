import type { JSX } from "react";
import type { Tab } from "../types";
import { AiChatView } from "./ai/AiChatView";

interface AiTabTerminalProps {
  tab: Tab;
  isActive: boolean;
}

export function AiTabTerminal({
  tab,
  isActive,
}: AiTabTerminalProps): JSX.Element {
  return (
    <div
      style={{
        display: isActive ? "flex" : "none",
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
      }}
    >
      <AiChatView paneId={tab.id} isActive={isActive} />
    </div>
  );
}
