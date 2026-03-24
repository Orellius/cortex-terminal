import { useState, useCallback } from "react";
import type { JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useHomeDir } from "./hooks/useHomeDir";
import { useTerminal } from "./hooks/useTerminal";
import { useStatusPoll } from "./hooks/useStatusPoll";
import { useKeyboard } from "./hooks/useKeyboard";
import { TitleBar } from "./components/TitleBar";
import { TerminalView } from "./components/TerminalView";
import { StatusBar } from "./components/StatusBar";
import { ProjectLauncher } from "./components/ProjectLauncher";
import type { ProjectEntry } from "./types";

export function App(): JSX.Element {
  const { homeDir, cwd, setCwd } = useHomeDir();

  // Launcher state
  const [showLauncher, setShowLauncher] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const { termRef, terminalRef, searchRef, fitRef: _fitRef } = useTerminal(
    cwd,
    setCwd
  );
  const { branch, usage } = useStatusPoll(cwd);

  const openLauncher = useCallback(async () => {
    try {
      const result = await invoke<ProjectEntry[]>("list_projects");
      setProjects(result);
    } catch {
      setProjects([]);
    }
    setShowLauncher(true);
  }, []);

  const closeLauncher = useCallback(() => {
    setShowLauncher(false);
  }, []);

  const selectProject = useCallback(
    async (project: ProjectEntry) => {
      setShowLauncher(false);
      setCwd(project.path);

      await invoke("kill_pty", { paneId: "main" }).catch(() => {});
      try {
        await invoke("spawn_pty", { paneId: "main", cwd: project.path });
        terminalRef.current?.clear();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        terminalRef.current?.write(`\x1b[31mpty error: ${msg}\x1b[0m\r\n`);
      }

      requestAnimationFrame(() => {
        terminalRef.current?.focus();
      });
    },
    [setCwd, terminalRef]
  );

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
  }, []);

  useKeyboard({
    openLauncher,
    closeLauncher,
    showLauncher,
    toggleSearch,
    showSearch,
    searchRef,
    terminalRef,
  });

  const shortPath = homeDir ? cwd.replace(homeDir, "~") : cwd || "~";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#09090b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <TitleBar shortPath={shortPath} />
      <TerminalView
        termRef={termRef}
        terminalRef={terminalRef}
        searchRef={searchRef}
        showSearch={showSearch}
        onCloseSearch={() => {
          setShowSearch(false);
          searchRef.current?.clearDecorations();
          terminalRef.current?.focus();
        }}
      />
      <StatusBar
        branch={branch}
        usage={usage}
        onOpenLauncher={openLauncher}
      />
      {showLauncher && (
        <ProjectLauncher
          projects={projects}
          onSelect={selectProject}
          onClose={closeLauncher}
        />
      )}
    </div>
  );
}
