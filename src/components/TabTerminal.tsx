import type { JSX } from "react";
import type { Tab } from "../types";
import { useTerminal } from "../hooks/useTerminal";
import { TerminalView } from "./TerminalView";

interface TabTerminalProps {
  tab: Tab;
  isActive: boolean;
  setCwd: (cwd: string) => void;
  showSearch: boolean;
  onCloseSearch: () => void;
}

export function TabTerminal({
  tab,
  isActive,
  setCwd,
  showSearch,
  onCloseSearch,
}: TabTerminalProps): JSX.Element {
  const { termRef, terminalRef, searchRef, fitRef: _fitRef } = useTerminal(
    tab.cwd,
    setCwd,
    tab.id,
    isActive
  );

  return (
    <div
      style={{
        display: isActive ? "flex" : "none",
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
      }}
    >
      <TerminalView
        termRef={termRef}
        terminalRef={terminalRef}
        searchRef={searchRef}
        showSearch={isActive && showSearch}
        onCloseSearch={onCloseSearch}
      />
    </div>
  );
}
