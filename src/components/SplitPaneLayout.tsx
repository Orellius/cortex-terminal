import { useState, useCallback, useRef, type JSX } from "react";
import type { Pane, SplitDirection } from "../types";
import { AiChatView } from "./ai/AiChatView";
import { TabTerminal } from "./TabTerminal";

interface SplitPaneLayoutProps {
  panes: Pane[];
  activePaneId: string;
  splitDirection: SplitDirection | null;
  tabId?: string;
  isTabActive: boolean;
  onActivatePane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  setCwd: (cwd: string) => void;
}

export function SplitPaneLayout({
  panes,
  activePaneId,
  splitDirection,
  tabId: _tabId,
  isTabActive,
  onActivatePane,
  onClosePane,
  setCwd,
}: SplitPaneLayoutProps): JSX.Element {
  // Single pane — no split layout
  if (panes.length <= 1) {
    const pane = panes[0];
    if (!pane) return <div />;
    return (
      <SinglePane
        pane={pane}
        isActive={isTabActive}
        setCwd={setCwd}
      />
    );
  }

  return (
    <ResizableSplit
      panes={panes}
      activePaneId={activePaneId}
      splitDirection={splitDirection ?? "vertical"}
      isTabActive={isTabActive}
      onActivatePane={onActivatePane}
      onClosePane={onClosePane}
      setCwd={setCwd}
    />
  );
}

// ─── Resizable Split ─────────────────────────────────────────

interface ResizableSplitProps {
  panes: Pane[];
  activePaneId: string;
  splitDirection: SplitDirection;
  isTabActive: boolean;
  onActivatePane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  setCwd: (cwd: string) => void;
}

function ResizableSplit({
  panes,
  activePaneId,
  splitDirection,
  isTabActive,
  onActivatePane,
  onClosePane,
  setCwd,
}: ResizableSplitProps): JSX.Element {
  const isVertical = splitDirection === "vertical";
  const containerRef = useRef<HTMLDivElement>(null);

  // Track sizes as percentages (one per pane)
  const [sizes, setSizes] = useState<number[]>(
    () => panes.map(() => 100 / panes.length)
  );

  // Ensure sizes array matches pane count
  const adjustedSizes = panes.length === sizes.length
    ? sizes
    : panes.map(() => 100 / panes.length);

  const handleDrag = useCallback((index: number, delta: number) => {
    const container = containerRef.current;
    if (!container) return;

    const totalSize = isVertical ? container.offsetWidth : container.offsetHeight;
    const pct = (delta / totalSize) * 100;

    setSizes((prev) => {
      const next = [...prev];
      const minPct = 15; // Minimum 15% per pane
      const newLeft = next[index] + pct;
      const newRight = next[index + 1] - pct;
      if (newLeft >= minPct && newRight >= minPct) {
        next[index] = newLeft;
        next[index + 1] = newRight;
      }
      return next;
    });
  }, [isVertical]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: isVertical ? "row" : "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {panes.map((pane, index) => (
        <PaneWithDivider
          key={pane.id}
          pane={pane}
          index={index}
          totalPanes={panes.length}
          size={adjustedSizes[index]}
          isActive={isTabActive && pane.id === activePaneId}
          isVertical={isVertical}
          onActivate={() => onActivatePane(pane.id)}
          onClose={() => onClosePane(pane.id)}
          onDrag={(delta) => handleDrag(index, delta)}
          setCwd={setCwd}
        />
      ))}
    </div>
  );
}

// ─── Individual Pane with Resize Divider ─────────────────────

interface PaneWithDividerProps {
  pane: Pane;
  index: number;
  totalPanes: number;
  size: number;
  isActive: boolean;
  isVertical: boolean;
  onActivate: () => void;
  onClose: () => void;
  onDrag: (delta: number) => void;
  setCwd: (cwd: string) => void;
}

function PaneWithDivider({
  pane,
  index,
  totalPanes,
  size,
  isActive,
  isVertical,
  onActivate,
  onClose,
  onDrag,
  setCwd,
}: PaneWithDividerProps): JSX.Element {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = isVertical ? e.clientX : e.clientY;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const current = isVertical ? ev.clientX : ev.clientY;
      const delta = current - lastPos.current;
      lastPos.current = current;
      onDrag(delta);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [isVertical, onDrag]);

  const isLast = index === totalPanes - 1;

  return (
    <>
      <div
        style={{
          flex: `0 0 ${size}%`,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={onActivate}
      >
        {/* Active indicator */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: isActive ? "#05a0ef" : "transparent",
            zIndex: 5,
            transition: "background 150ms",
          }}
        />

        {/* Pane header bar */}
        {totalPanes > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.125rem 0.5rem",
              background: isActive ? "rgba(5, 160, 239, 0.05)" : "transparent",
              borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
              minHeight: "1.25rem",
            }}
          >
            <span
              style={{
                fontFamily: '"Geist Mono", Menlo, monospace',
                fontSize: "0.5625rem",
                color: isActive ? "#52525b" : "#27272a",
                fontWeight: 500,
              }}
            >
              {pane.kind === "ai" ? "AI" : "Shell"}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                background: "none",
                border: "none",
                color: "#27272a",
                fontSize: "0.625rem",
                cursor: "pointer",
                padding: "0 0.25rem",
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        )}

        <SinglePane pane={pane} isActive={isActive} setCwd={setCwd} />
      </div>

      {/* Resize divider */}
      {!isLast && (
        <div
          onMouseDown={startDrag}
          style={{
            flex: "0 0 4px",
            background: "rgba(255, 255, 255, 0.04)",
            cursor: isVertical ? "col-resize" : "row-resize",
            zIndex: 10,
            transition: "background 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(5, 160, 239, 0.3)";
          }}
          onMouseLeave={(e) => {
            if (!dragging.current) {
              (e.currentTarget as HTMLDivElement).style.background = "rgba(255, 255, 255, 0.04)";
            }
          }}
        />
      )}
    </>
  );
}

// ─── Single Pane Renderer ────────────────────────────────────

interface SinglePaneProps {
  pane: Pane;
  isActive: boolean;
  setCwd: (cwd: string) => void;
}

function SinglePane({ pane, isActive, setCwd }: SinglePaneProps): JSX.Element {
  if (pane.kind === "ai") {
    return <AiChatView paneId={pane.id} isActive={isActive} cwd={pane.cwd} />;
  }

  return (
    <TabTerminal
      tab={{
        id: pane.id,
        title: pane.cwd,
        cwd: pane.cwd,
        kind: "shell",
        panes: [pane],
        activePaneId: pane.id,
        splitDirection: null,
      }}
      isActive={isActive}
      setCwd={setCwd}
      showSearch={false}
      onCloseSearch={() => {}}
    />
  );
}
