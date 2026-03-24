import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent,
} from "react";
import { TerminalPane } from "./TerminalPane";

interface PaneConfig {
  id: string;
  cwd: string;
  flexBasis: number; // 0–1, fraction of total width
}

interface PaneLayoutProps {
  panes: PaneConfig[];
  activePaneId: string;
  onActivate: (id: string) => void;
}

interface DragState {
  startX: number;
  leftIndex: number;
  leftBasisStart: number;
  rightBasisStart: number;
}

const MIN_PANE_FRACTION = 0.15; // floor so no pane collapses below ~15% of container

export function PaneLayout({
  panes,
  activePaneId,
  onActivate,
}: PaneLayoutProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [bases, setBases] = useState<number[]>(() =>
    panes.map(() => 1 / panes.length)
  );

  // When pane count changes externally, redistribute bases evenly
  useEffect(() => {
    setBases(panes.map(() => 1 / panes.length));
  }, [panes.length]);

  const startDrag = useCallback(
    (e: MouseEvent<HTMLDivElement>, handleIndex: number) => {
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        leftIndex: handleIndex,
        leftBasisStart: bases[handleIndex],
        rightBasisStart: bases[handleIndex + 1],
      };

      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? 1;

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const drag = dragStateRef.current;
        if (!drag) return;

        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const delta = (moveEvent.clientX - drag.startX) / containerWidth;
          const newLeft = Math.max(
            MIN_PANE_FRACTION,
            Math.min(
              drag.leftBasisStart + drag.rightBasisStart - MIN_PANE_FRACTION,
              drag.leftBasisStart + delta
            )
          );
          const newRight =
            drag.leftBasisStart + drag.rightBasisStart - newLeft;

          setBases((prev) => {
            const next = [...prev];
            next[drag.leftIndex] = newLeft;
            next[drag.leftIndex + 1] = newRight;
            return next;
          });
        }, 16);
      };

      const onMouseUp = () => {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [bases]
  );

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      {panes.map((pane, index) => (
        <div
          key={pane.id}
          className="flex min-w-[300px] min-h-0"
          style={{ flex: `${bases[index] ?? 1 / panes.length} 1 0` }}
          onMouseDown={() => onActivate(pane.id)}
        >
          <TerminalPane
            paneId={pane.id}
            cwd={pane.cwd}
            isActive={pane.id === activePaneId}
          />

          {/* Drag handle between panes */}
          {index < panes.length - 1 && (
            <div
              className="w-1 shrink-0 cursor-col-resize select-none transition-colors duration-150"
              style={{
                background: "rgba(255,255,255,0.05)",
              }}
              onMouseDown={(e) => startDrag(e, index)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(5,160,239,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(255,255,255,0.05)";
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
