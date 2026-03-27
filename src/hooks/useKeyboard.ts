import { useEffect } from "react";
import type { SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";

interface KeyboardCallbacks {
  openLauncher: () => void;
  closeLauncher: () => void;
  showLauncher: boolean;
  toggleSearch: () => void;
  showSearch: boolean;
  searchRef: React.RefObject<SearchAddon | null>;
  terminalRef: React.RefObject<Terminal | null>;
  addTab: () => void;
  closeTab: () => void;
  switchTabByIndex: (index: number) => void;
  toggleSettings: () => void;
  splitVertical: () => void;
  splitHorizontal: () => void;
  togglePasteHistory: () => void;
}

export function useKeyboard({
  openLauncher,
  closeLauncher,
  showLauncher,
  toggleSearch,
  showSearch,
  searchRef,
  terminalRef,
  addTab,
  closeTab,
  switchTabByIndex,
  toggleSettings,
  splitVertical,
  splitHorizontal,
  togglePasteHistory,
}: KeyboardCallbacks): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) return;

      // Cmd+Shift+H = paste history
      if (e.key === "h" && e.shiftKey) {
        e.preventDefault();
        togglePasteHistory();
        return;
      }

      // Cmd+D = split vertical, Cmd+Shift+D = split horizontal
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        if (e.shiftKey) {
          splitHorizontal();
        } else {
          splitVertical();
        }
        return;
      }

      if (e.key === ",") {
        e.preventDefault();
        toggleSettings();
        return;
      }

      if (e.key === "k") {
        e.preventDefault();
        showLauncher ? closeLauncher() : openLauncher();
        return;
      }

      if (e.key === "f") {
        e.preventDefault();
        toggleSearch();
        if (showSearch) {
          searchRef.current?.clearDecorations();
          terminalRef.current?.focus();
        }
        return;
      }

      if (e.key === "t") {
        e.preventDefault();
        addTab();
        return;
      }

      if (e.key === "w") {
        e.preventDefault();
        closeTab();
        return;
      }

      const digit = parseInt(e.key, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        e.preventDefault();
        switchTabByIndex(digit - 1);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    showLauncher,
    showSearch,
    openLauncher,
    closeLauncher,
    toggleSearch,
    searchRef,
    terminalRef,
    addTab,
    closeTab,
    switchTabByIndex,
    toggleSettings,
    splitVertical,
    splitHorizontal,
    togglePasteHistory,
  ]);
}
