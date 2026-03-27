import { useState, useCallback, useEffect, useRef } from "react";
import type { Tab, TabKind, Pane, SplitDirection } from "../types";

interface UseTabsResult {
  tabs: Tab[];
  activeTabId: string;
  addTab: (kind?: TabKind, cwd?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabCwd: (id: string, cwd: string) => void;
  splitPane: (direction: SplitDirection) => void;
  closePaneInTab: (tabId: string, paneId: string) => void;
  setActivePaneInTab: (tabId: string, paneId: string) => void;
}

function makePane(cwd: string, kind: TabKind): Pane {
  return { id: crypto.randomUUID(), kind, cwd };
}

function makeTab(cwd: string, kind: TabKind = "ai"): Tab {
  const pane = makePane(cwd, kind);
  return {
    id: crypto.randomUUID(),
    title: kind === "ai" ? "AI" : cwd,
    cwd,
    kind,
    panes: [pane],
    activePaneId: pane.id,
    splitDirection: null,
  };
}

export function useTabs(homeDir: string): UseTabsResult {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!homeDir || initialized.current) return;
    initialized.current = true;
    const first = makeTab(homeDir, "ai");
    setTabs([first]);
    setActiveTabId(first.id);
  }, [homeDir]);

  const addTab = useCallback(
    (kind: TabKind = "ai", cwd?: string) => {
      const tab = makeTab(cwd ?? homeDir, kind);
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    [homeDir]
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        setActiveTabId((current) => {
          if (current !== id) return current;
          const adjacent = next[idx] ?? next[idx - 1] ?? next[0];
          return adjacent?.id ?? current;
        });
        return next;
      });
    },
    []
  );

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const updateTabTitle = useCallback((id: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title } : t))
    );
  }, []);

  const updateTabCwd = useCallback((id: string, cwd: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, cwd, title: t.kind === "shell" ? cwd : t.title } : t))
    );
  }, []);

  /** Split the active pane in the active tab */
  const splitPane = useCallback(
    (direction: SplitDirection) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          // Create a new pane of the same kind as the active one
          const activePane = tab.panes.find((p) => p.id === tab.activePaneId);
          const kind = activePane?.kind ?? tab.kind;
          const cwd = activePane?.cwd ?? tab.cwd;
          const newPane = makePane(cwd, kind);
          return {
            ...tab,
            panes: [...tab.panes, newPane],
            activePaneId: newPane.id,
            splitDirection: tab.splitDirection ?? direction,
          };
        })
      );
    },
    [activeTabId]
  );

  /** Close a specific pane within a tab */
  const closePaneInTab = useCallback((tabId: string, paneId: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        if (tab.panes.length <= 1) return tab; // Don't close last pane
        const remaining = tab.panes.filter((p) => p.id !== paneId);
        const newActive = tab.activePaneId === paneId
          ? remaining[0].id
          : tab.activePaneId;
        return {
          ...tab,
          panes: remaining,
          activePaneId: newActive,
          splitDirection: remaining.length <= 1 ? null : tab.splitDirection,
        };
      })
    );
  }, []);

  /** Set the active pane within a tab */
  const setActivePaneInTab = useCallback((tabId: string, paneId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, activePaneId: paneId } : tab
      )
    );
  }, []);

  return {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    switchTab,
    updateTabTitle,
    updateTabCwd,
    splitPane,
    closePaneInTab,
    setActivePaneInTab,
  };
}
