import type { JSX } from "react";
import type { Terminal } from "@xterm/xterm";
import type { SearchAddon } from "@xterm/addon-search";
import cortexLogo from "../assets/cortex-logo.png";
import { SearchBar } from "./SearchBar";

interface TerminalViewProps {
  termRef: React.RefObject<HTMLDivElement | null>;
  terminalRef: React.RefObject<Terminal | null>;
  searchRef: React.RefObject<SearchAddon | null>;
  showSearch: boolean;
  onCloseSearch: () => void;
}

export function TerminalView({
  termRef,
  terminalRef,
  searchRef,
  showSearch,
  onCloseSearch,
}: TerminalViewProps): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Centered logo watermark — behind terminal content */}
      <img
        src={cortexLogo}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(14vw, 10rem)",
          height: "auto",
          opacity: 0.07,
          filter:
            "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(85deg)",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />

      {showSearch && (
        <SearchBar
          searchAddon={searchRef.current}
          onClose={onCloseSearch}
        />
      )}

      {/* Terminal layer */}
      <div
        ref={termRef}
        onClick={() => terminalRef.current?.focus()}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          padding: "0 0.5rem",
          zIndex: 1,
        }}
      />
    </div>
  );
}
