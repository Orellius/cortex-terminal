import { useEffect, type JSX } from "react";
import type { Tab } from "../types";
import { useTerminal } from "../hooks/useTerminal";
import { useAiInput } from "../hooks/useAiInput";
import { useAiStream } from "../hooks/useAiStream";
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
  const { termRef, terminalRef, searchRef, fitRef: _fitRef, aiHandlerRef } =
    useTerminal(tab.cwd, setCwd, tab.id, isActive);

  // AI input interception — # prefix detection
  const handleAiInput = useAiInput(tab.id, terminalRef);

  // Wire the AI handler into the terminal's onData path
  useEffect(() => {
    aiHandlerRef.current = handleAiInput;
    return () => {
      aiHandlerRef.current = null;
    };
  }, [handleAiInput, aiHandlerRef]);

  // AI stream listener — renders responses inline
  useAiStream(tab.id, terminalRef);

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
