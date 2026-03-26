import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Terminal } from "@xterm/xterm";
import { formatAiResponse } from "../ai/formatter";

interface AiStreamEvent {
  readonly pane_id: string;
  readonly provider: string;
  readonly model: string;
  readonly chunk: string;
  readonly done: boolean;
  readonly cost: number;
  readonly duration_ms: number;
  readonly verified: boolean;
}

/**
 * Listens for cortex:ai:stream events and writes formatted AI responses
 * directly to the xterm terminal instance.
 */
export function useAiStream(
  paneId: string,
  terminalRef: React.RefObject<Terminal | null>
): void {
  const paneIdRef = useRef(paneId);
  paneIdRef.current = paneId;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<AiStreamEvent>("cortex:ai:stream", (event) => {
      const data = event.payload;
      if (data.pane_id !== paneIdRef.current) return;

      const term = terminalRef.current;
      if (!term) return;

      if (data.done) {
        // Clear the "thinking..." line and write formatted response
        term.write("\x1b[2K\r"); // Clear current line
        const formatted = formatAiResponse({
          provider: data.provider,
          model: data.model,
          content: data.chunk,
          cost: data.cost,
          durationMs: data.duration_ms,
          verified: data.verified,
        });
        term.write(formatted);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [terminalRef]);
}
