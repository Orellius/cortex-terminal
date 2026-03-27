import { useState, useEffect, useRef, useCallback, type JSX } from "react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function CommandPalette({ commands, onClose }: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Reset selection when filter changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[selectedIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const execute = useCallback((cmd: Command) => {
    cmd.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      execute(filtered[selectedIndex]);
      return;
    }
  }, [filtered, selectedIndex, execute, onClose]);

  // Group by category
  let lastCategory = "";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "center", paddingTop: "15vh", background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(32rem, 85vw)", maxHeight: "24rem", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Input */}
        <div style={{ padding: "0.625rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{ ...MONO, width: "100%", background: "transparent", border: "none", outline: "none", color: "#e4e4e7", fontSize: "0.8125rem" }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "0.25rem 0" }}>
          {filtered.length === 0 && (
            <div style={{ ...MONO, fontSize: "0.6875rem", color: "#3f3f46", padding: "1rem", textAlign: "center" }}>
              No matching commands
            </div>
          )}
          {filtered.map((cmd, i) => {
            const showCategory = cmd.category !== lastCategory;
            lastCategory = cmd.category;
            return (
              <div key={cmd.id}>
                {showCategory && (
                  <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", padding: "0.5rem 0.75rem 0.125rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {cmd.category}
                  </div>
                )}
                <div
                  onClick={() => execute(cmd)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.375rem 0.75rem", cursor: "pointer",
                    background: i === selectedIndex ? "rgba(255,255,255,0.06)" : "transparent",
                    borderRadius: i === selectedIndex ? "0.25rem" : "0",
                    margin: "0 0.25rem",
                  }}
                >
                  <span style={{ ...MONO, fontSize: "0.6875rem", color: i === selectedIndex ? "#e4e4e7" : "#a1a1aa" }}>
                    {cmd.label}
                  </span>
                  {cmd.shortcut && (
                    <span style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", background: "rgba(255,255,255,0.04)", padding: "0.0625rem 0.3rem", borderRadius: "0.1875rem" }}>
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Build the default command list from app callbacks */
export function buildCommands(callbacks: {
  addAiTab: () => void;
  addShellTab: () => void;
  toggleSettings: () => void;
  toggleSearch: () => void;
  openLauncher: () => void;
  splitVertical: () => void;
  splitHorizontal: () => void;
  togglePasteHistory: () => void;
  closeTab: () => void;
  reopenClosedTab: () => void;
}): Command[] {
  return [
    { id: "new-ai", label: "New AI Tab", shortcut: "Cmd+T", action: callbacks.addAiTab, category: "Tabs" },
    { id: "new-shell", label: "New Shell Tab", shortcut: "", action: callbacks.addShellTab, category: "Tabs" },
    { id: "close-tab", label: "Close Tab", shortcut: "Cmd+W", action: callbacks.closeTab, category: "Tabs" },
    { id: "reopen-tab", label: "Reopen Closed Tab", shortcut: "Cmd+Shift+T", action: callbacks.reopenClosedTab, category: "Tabs" },
    { id: "split-v", label: "Split Vertical", shortcut: "Cmd+D", action: callbacks.splitVertical, category: "Panes" },
    { id: "split-h", label: "Split Horizontal", shortcut: "Cmd+Shift+D", action: callbacks.splitHorizontal, category: "Panes" },
    { id: "search", label: "Find in Pane", shortcut: "Cmd+F", action: callbacks.toggleSearch, category: "Navigation" },
    { id: "projects", label: "Open Projects", shortcut: "Cmd+K", action: callbacks.openLauncher, category: "Navigation" },
    { id: "settings", label: "Open Settings", shortcut: "Cmd+,", action: callbacks.toggleSettings, category: "Navigation" },
    { id: "paste-history", label: "Paste History", shortcut: "Cmd+Shift+H", action: callbacks.togglePasteHistory, category: "Navigation" },
  ];
}
