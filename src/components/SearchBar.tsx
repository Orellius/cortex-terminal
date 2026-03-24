import { useState, useEffect, useRef, useCallback } from "react";
import type { JSX } from "react";
import type { SearchAddon } from "@xterm/addon-search";

interface SearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function SearchBar({ searchAddon, onClose }: SearchBarProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const doSearch = useCallback(
    (term: string, direction: "next" | "prev" = "next") => {
      if (!searchAddon || !term) {
        setMatchCount(null);
        return;
      }
      const found =
        direction === "next"
          ? searchAddon.findNext(term, { regex: false, caseSensitive: false, decorations: {
              matchOverviewRuler: "#05a0ef80",
              activeMatchColorOverviewRuler: "#05a0ef",
              matchBackground: "#05a0ef30",
              activeMatchBackground: "#05a0ef60",
            }})
          : searchAddon.findPrevious(term, { regex: false, caseSensitive: false, decorations: {
              matchOverviewRuler: "#05a0ef80",
              activeMatchColorOverviewRuler: "#05a0ef",
              matchBackground: "#05a0ef30",
              activeMatchBackground: "#05a0ef60",
            }});
      setMatchCount(found ? -1 : 0); // -1 = has matches, 0 = none
    },
    [searchAddon]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      searchAddon?.clearDecorations();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch(query, e.shiftKey ? "prev" : "next");
      return;
    }
  };

  useEffect(() => {
    if (query.length > 0) {
      doSearch(query);
    } else {
      searchAddon?.clearDecorations();
      setMatchCount(null);
    }
  }, [query, doSearch, searchAddon]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: "0.5rem",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.5rem",
        background: "#1a1a1e",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderTop: "none",
        borderRadius: "0 0 0.375rem 0.375rem",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          width: "12rem",
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.75rem",
          color: "#d4d4d8",
          padding: "0.125rem 0",
        }}
      />

      {/* Match indicator */}
      {query.length > 0 && (
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: "0.625rem",
            color: matchCount === 0 ? "#f43f5e" : "#52525b",
            whiteSpace: "nowrap",
          }}
        >
          {matchCount === 0 ? "no match" : ""}
        </span>
      )}

      {/* Nav buttons */}
      <button
        onClick={() => doSearch(query, "prev")}
        style={{
          background: "transparent",
          border: "none",
          color: "#71717a",
          cursor: "pointer",
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.75rem",
          padding: "0 0.125rem",
          lineHeight: 1,
        }}
        title="Previous (Shift+Enter)"
      >
        &#8593;
      </button>
      <button
        onClick={() => doSearch(query, "next")}
        style={{
          background: "transparent",
          border: "none",
          color: "#71717a",
          cursor: "pointer",
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.75rem",
          padding: "0 0.125rem",
          lineHeight: 1,
        }}
        title="Next (Enter)"
      >
        &#8595;
      </button>

      {/* Close */}
      <button
        onClick={() => {
          searchAddon?.clearDecorations();
          onClose();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#52525b",
          cursor: "pointer",
          fontFamily: '"Geist Mono", monospace',
          fontSize: "0.75rem",
          padding: "0 0.125rem",
          lineHeight: 1,
        }}
        title="Close (Esc)"
      >
        &#10005;
      </button>
    </div>
  );
}
