import type { JSX } from "react";
import type { Pane, SplitDirection } from "../types";
import { AiChatView } from "./ai/AiChatView";
import { TabTerminal } from "./TabTerminal";

interface SplitPaneLayoutProps {
  panes: Pane[];
  activePaneId: string;
  splitDirection: SplitDirection | null;
  tabId: string;
  isTabActive: boolean;
  onActivatePane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  setCwd: (cwd: string) => void;
}

export function SplitPaneLayout({
  panes,
  activePaneId,
  splitDirection,
  tabId,
  isTabActive,
  onActivatePane,
  onClosePane,
  setCwd,
}: SplitPaneLayoutProps): JSX.Element {
  // Single pane — no split layout needed
  if (panes.length <= 1) {
    const pane = panes[0];
    if (!pane) return <div />;
    return (
      <SinglePane
        pane={pane}
        isActive={isTabActive}
        tabId={tabId}
        setCwd={setCwd}
      />
    );
  }

  const isVertical = splitDirection === "vertical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isVertical ? "row" : "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {panes.map((pane, index) => (
        <div
          key={pane.id}
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            borderRight: isVertical && index < panes.length - 1
              ? "1px solid rgba(255, 255, 255, 0.06)"
              : undefined,
            borderBottom: !isVertical && index < panes.length - 1
              ? "1px solid rgba(255, 255, 255, 0.06)"
              : undefined,
          }}
          onClick={() => onActivatePane(pane.id)}
        >
          {/* Active pane indicator */}
          {panes.length > 1 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background: pane.id === activePaneId
                  ? "#05a0ef"
                  : "transparent",
                zIndex: 5,
                transition: "background 150ms",
              }}
            />
          )}

          {/* Close pane button (only if multiple panes) */}
          {panes.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClosePane(pane.id);
              }}
              style={{
                position: "absolute",
                top: "0.25rem",
                right: "0.25rem",
                zIndex: 10,
                background: "none",
                border: "none",
                color: "#3f3f46",
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: "0.125rem 0.25rem",
                borderRadius: "0.25rem",
                lineHeight: 1,
                opacity: 0.5,
              }}
              title="Close pane"
            >
              x
            </button>
          )}

          <SinglePane
            pane={pane}
            isActive={isTabActive && pane.id === activePaneId}
            tabId={tabId}
            setCwd={setCwd}
          />
        </div>
      ))}
    </div>
  );
}

interface SinglePaneProps {
  pane: Pane;
  isActive: boolean;
  tabId: string;
  setCwd: (cwd: string) => void;
}

function SinglePane({ pane, isActive, tabId: _tabId, setCwd }: SinglePaneProps): JSX.Element {
  if (pane.kind === "ai") {
    return <AiChatView paneId={pane.id} isActive={isActive} />;
  }

  // Shell pane — use TabTerminal with a virtual tab
  return (
    <TabTerminal
      tab={{ id: pane.id, title: pane.cwd, cwd: pane.cwd, kind: "shell", panes: [pane], activePaneId: pane.id, splitDirection: null }}
      isActive={isActive}
      setCwd={setCwd}
      showSearch={false}
      onCloseSearch={() => {}}
    />
  );
}
