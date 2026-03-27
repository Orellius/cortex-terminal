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
        borderBottom: "none",
        userSelect: "none",
        // Leave space for macOS stoplight buttons (traffic lights)
        paddingLeft: "5rem",
        paddingRight: "0.75rem",
        // Ensure the entire bar is draggable
        WebkitUserSelect: "none" as string,
      }}
    >
      <span
        data-tauri-drag-region=""
        style={{
          fontFamily: '"Geist Mono", Menlo, monospace',
          fontSize: "0.8rem",
          color: "#71717a",
          letterSpacing: "0.02em",
          pointerEvents: "none",
        }}
      >
        {shortPath}
      </span>
    </div>
  );
}
