import { useState, useCallback, useRef, useEffect } from "react";
import type { JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHomeDir } from "./hooks/useHomeDir";
import { useTabs } from "./hooks/useTabs";
import { useStatusPoll } from "./hooks/useStatusPoll";
import { useKeyboard } from "./hooks/useKeyboard";
import { TitleBar } from "./components/TitleBar";
import { TabBar } from "./components/TabBar";
import { SplitPaneLayout } from "./components/SplitPaneLayout";
import { StatusBar } from "./components/StatusBar";
import { ProjectLauncher } from "./components/ProjectLauncher";
import { SettingsOverlay } from "./components/settings/SettingsOverlay";
import { PasteHistory } from "./components/PasteHistory";
import { usePasteHistory } from "./hooks/usePasteHistory";
import type { ProjectEntry } from "./types";
import type { Terminal } from "@xterm/xterm";
import type { SearchAddon } from "@xterm/addon-search";

export function App(): JSX.Element {
  const { homeDir } = useHomeDir();

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    switchTab,
    updateTabCwd,
    splitPane,
    closePaneInTab,
    setActivePaneInTab,
  } = useTabs(homeDir);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Save session on window close
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async () => {
      if (tabs.length > 0) {
        const sessionTabs = tabs.map((tab) => ({
          tab_id: tab.id,
          kind: tab.kind,
          cwd: tab.cwd,
          title: tab.title,
          conversation_id: null,
        }));
        await invoke("save_session", { tabs: sessionTabs }).catch(() => {});
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [tabs]);

  // Per-tab terminal refs — keyed by tab id
  const terminalRefs = useRef<Map<string, React.RefObject<Terminal | null>>>(
    new Map()
  );
  const searchRefs = useRef<Map<string, React.RefObject<SearchAddon | null>>>(
    new Map()
  );

  // Launcher / search / settings state
  const [showLauncher, setShowLauncher] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const pasteHistory = usePasteHistory();

  // Stable sentinel refs for keyboard hook (always point to active tab's refs)
  const activeTerminalRef = useRef<Terminal | null>(null);
  const activeSearchRef = useRef<SearchAddon | null>(null);

  // Proxy refs that always delegate to the active tab's underlying refs
  const terminalRefProxy: React.RefObject<Terminal | null> = {
    get current() {
      return terminalRefs.current.get(activeTabId)?.current ?? null;
    },
    set current(value) {
      activeTerminalRef.current = value;
    },
  };

  const searchRefProxy: React.RefObject<SearchAddon | null> = {
    get current() {
      return searchRefs.current.get(activeTabId)?.current ?? null;
    },
    set current(value) {
      activeSearchRef.current = value;
    },
  };

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
      updateTabCwd(activeTabId, project.path);

      await invoke("kill_pty", { paneId: activeTabId }).catch(() => {});
      try {
        await invoke("spawn_pty", {
          paneId: activeTabId,
          cwd: project.path,
        });
        terminalRefProxy.current?.clear();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        terminalRefProxy.current?.write(
          `\x1b[31mpty error: ${msg}\x1b[0m\r\n`
        );
      }

      requestAnimationFrame(() => {
        terminalRefProxy.current?.focus();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTabId, updateTabCwd]
  );

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => !prev);
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const addAiTab = useCallback(() => {
    addTab("ai");
  }, [addTab]);

  const addShellTab = useCallback(() => {
    addTab("shell");
  }, [addTab]);

  const closeActiveTab = useCallback(() => {
    closeTab(activeTabId);
  }, [closeTab, activeTabId]);

  const switchTabByIndex = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (tab) switchTab(tab.id);
    },
    [tabs, switchTab]
  );

  useKeyboard({
    openLauncher,
    closeLauncher,
    showLauncher,
    toggleSearch,
    showSearch,
    searchRef: searchRefProxy,
    terminalRef: terminalRefProxy,
    addTab: addAiTab,
    closeTab: closeActiveTab,
    switchTabByIndex,
    toggleSettings,
    splitVertical: () => splitPane("vertical"),
    splitHorizontal: () => splitPane("horizontal"),
    togglePasteHistory: pasteHistory.toggleHistory,
  });

  const { branch, usage } = useStatusPoll(activeTab?.cwd ?? "");

  const shortPath = homeDir
    ? (activeTab?.cwd ?? "").replace(homeDir, "~")
    : activeTab?.cwd || "~";

  void showSearch; // used later when search is wired into split panes

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
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        homeDir={homeDir}
        onAdd={addAiTab}
        onAddShell={addShellTab}
        onClose={closeTab}
        onSwitch={switchTab}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: tab.id === activeTabId ? "flex" : "none",
              flex: 1,
              minHeight: 0,
              flexDirection: "column",
            }}
          >
            <SplitPaneLayout
              panes={tab.panes}
              activePaneId={tab.activePaneId}
              splitDirection={tab.splitDirection}
              tabId={tab.id}
              isTabActive={tab.id === activeTabId}
              onActivatePane={(paneId) => setActivePaneInTab(tab.id, paneId)}
              onClosePane={(paneId) => closePaneInTab(tab.id, paneId)}
              setCwd={(cwd) => updateTabCwd(tab.id, cwd)}
            />
          </div>
        ))}
      </div>

      <StatusBar
        branch={branch}
        usage={usage}
        onOpenLauncher={openLauncher}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showLauncher && (
        <ProjectLauncher
          projects={projects}
          onSelect={selectProject}
          onClose={closeLauncher}
        />
      )}
      {showSettings && (
        <SettingsOverlay onClose={() => setShowSettings(false)} />
      )}
      {pasteHistory.showHistory && (
        <PasteHistory
          history={pasteHistory.history}
          onSelect={() => {}}
          onClose={pasteHistory.closeHistory}
          onClear={pasteHistory.clearHistory}
        />
      )}
    </div>
  );
}
