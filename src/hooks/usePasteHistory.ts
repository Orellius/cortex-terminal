import { useState, useCallback, useEffect } from "react";

const MAX_HISTORY = 30;
const STORAGE_KEY = "cortex_paste_history";

export interface PasteHistoryEntry {
  text: string;
  timestamp: number;
}

interface UsePasteHistoryResult {
  history: PasteHistoryEntry[];
  addEntry: (text: string) => void;
  clearHistory: () => void;
  showHistory: boolean;
  toggleHistory: () => void;
  closeHistory: () => void;
}

export function usePasteHistory(): UsePasteHistoryResult {
  const [history, setHistory] = useState<PasteHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // localStorage full or unavailable
    }
  }, [history]);

  // Copy-on-select: listen for selection changes
  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 0 && text.length < 10000) {
        navigator.clipboard.writeText(text).catch(() => {});
        addEntryDirect(text);
      }
    };

    // Listen for mouseup (end of selection)
    document.addEventListener("mouseup", handler);
    return () => document.removeEventListener("mouseup", handler);
  }, []);

  const addEntryDirect = (text: string) => {
    setHistory((prev) => {
      // Deduplicate — don't add if already the most recent
      if (prev.length > 0 && prev[0].text === text) return prev;
      const entry: PasteHistoryEntry = { text, timestamp: Date.now() };
      return [entry, ...prev.filter((e) => e.text !== text)].slice(0, MAX_HISTORY);
    });
  };

  const addEntry = useCallback((text: string) => {
    addEntryDirect(text);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  return { history, addEntry, clearHistory, showHistory, toggleHistory, closeHistory };
}
