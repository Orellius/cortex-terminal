import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface PtyOutputPayload {
  pane_id: string;
  data: number[];
}

const encoder = new TextEncoder();

export function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const term = new Terminal({
      fontFamily: "Menlo, monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: { background: "#09090b" },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();
    term.focus();

    term.write("\x1b[32mCortex terminal test\x1b[0m\r\n");

    // PTY
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await listen<PtyOutputPayload>("pty:output:main", (e) => {
        term.write(new Uint8Array(e.payload.data));
      });
      await invoke("kill_pty", { paneId: "main" }).catch(() => {});
      await invoke("spawn_pty", { paneId: "main", cwd: "/Users/orelohayon" });
    })();

    term.onData((data) => {
      invoke("write_pty", {
        paneId: "main",
        data: Array.from(encoder.encode(data)),
      }).catch(() => {});
    });

    return () => {
      unlisten?.();
      invoke("kill_pty", { paneId: "main" }).catch(() => {});
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#09090b",
      }}
    />
  );
}
