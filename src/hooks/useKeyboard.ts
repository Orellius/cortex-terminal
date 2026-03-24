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
}

export function useKeyboard({
  openLauncher,
  closeLauncher,
  showLauncher,
  toggleSearch,
  showSearch,
  searchRef,
  terminalRef,
}: KeyboardCallbacks): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) return;

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
  ]);
}
