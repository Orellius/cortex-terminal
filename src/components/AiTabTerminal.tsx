import type { JSX } from "react";
import type { Tab } from "../types";
import { useAiTerminal } from "../hooks/useAiTerminal";
import watermark from "../assets/cortex-watermark.png";

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
        position: "relative",
      }}
    >
      {/* Watermark — eye beams at top center */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "40%",
          maxWidth: "24rem",
          opacity: 0.04,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src={watermark}
          alt=""
          style={{
            width: "100%",
            objectFit: "contain",
            objectPosition: "top center",
          }}
        />
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          minHeight: 0,
          paddingLeft: "0.5rem",
          paddingTop: "0.25rem",
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}
