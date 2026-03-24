import type { JSX } from "react";
import { TITLE_BAR_HEIGHT } from "../constants";

interface TitleBarProps {
  shortPath: string;
}

export function TitleBar({ shortPath }: TitleBarProps): JSX.Element {
  return (
    <div
      data-tauri-drag-region=""
      style={{
        height: TITLE_BAR_HEIGHT,
        minHeight: TITLE_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.6875rem",
          color: "#71717a",
          letterSpacing: "0.01em",
        }}
      >
        {shortPath}
      </span>
    </div>
  );
}
