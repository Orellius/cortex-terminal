import { useState, useCallback, useEffect, useRef } from "react";
import type { Tab } from "../types";

interface UseTabsResult {
  tabs: Tab[];
  activeTabId: string;
  addTab: (cwd?: string) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabCwd: (id: string, cwd: string) => void;
}

function makeTab(cwd: string): Tab {
  return {
    id: crypto.randomUUID(),
    title: cwd,
    cwd,
  };
}

export function useTabs(homeDir: string): UseTabsResult {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const initialized = useRef(false);

  // Create first tab only after homeDir resolves
  useEffect(() => {
    if (!homeDir || initialized.current) return;
    initialized.current = true;
    const first = makeTab(homeDir);
    setTabs([first]);
    setActiveTabId(first.id);
  }, [homeDir]);

  const addTab = useCallback(
    (cwd?: string) => {
      const tab = makeTab(cwd ?? homeDir);
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    [homeDir]
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev; // minimum 1 tab
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        setActiveTabId((current) => {
          if (current !== id) return current;
          // switch to adjacent: prefer right, fall back to left
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
      prev.map((t) => (t.id === id ? { ...t, cwd, title: cwd } : t))
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
  };
}
