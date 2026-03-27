import { useState, useCallback, type JSX } from "react";

interface ThemeConfig {
  fontSize: number;
  fontFamily: "geist-mono" | "menlo" | "sf-mono" | "jetbrains";
  cursorStyle: "block" | "bar" | "underline";
  opacity: number;
  accentColor: string;
}

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

const CARD: React.CSSProperties = {
  padding: "0.75rem", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.375rem", background: "rgba(255,255,255,0.02)",
};

const ACCENT_COLORS = [
  { name: "Blue", value: "#05a0ef" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "White", value: "#e4e4e7" },
];

const FONTS = [
  { id: "geist-mono", label: "Geist Mono", family: '"Geist Mono", monospace' },
  { id: "menlo", label: "Menlo", family: "Menlo, monospace" },
  { id: "sf-mono", label: "SF Mono", family: '"SF Mono", monospace' },
  { id: "jetbrains", label: "JetBrains Mono", family: '"JetBrains Mono", monospace' },
];

export function ThemeTab(): JSX.Element {
  const [theme, setTheme] = useState<ThemeConfig>({
    fontSize: 13,
    fontFamily: "geist-mono",
    cursorStyle: "bar",
    opacity: 100,
    accentColor: "#05a0ef",
  });

  const update = useCallback(<K extends keyof ThemeConfig>(key: K, val: ThemeConfig[K]) => {
    setTheme((prev) => ({ ...prev, [key]: val }));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>Appearance</div>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginTop: "0.25rem" }}>
          Customize terminal look and feel.
        </div>
      </div>

      {/* Font Size */}
      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Font Size</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="range" min={10} max={20} step={1}
            value={theme.fontSize}
            onChange={(e) => update("fontSize", parseInt(e.target.value))}
            style={{ flex: 1, accentColor: theme.accentColor }}
          />
          <span style={{ ...MONO, fontSize: "0.75rem", color: "#a1a1aa", fontVariantNumeric: "tabular-nums", minWidth: "2.5rem" }}>
            {theme.fontSize}px
          </span>
        </div>
        <div style={{ ...MONO, fontSize: theme.fontSize * 0.0625 + "rem", color: "#71717a", marginTop: "0.5rem" }}>
          The quick brown fox jumps over the lazy dog
        </div>
      </div>

      {/* Font Family */}
      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Font Family</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {FONTS.map((font) => (
            <button
              key={font.id}
              onClick={() => update("fontFamily", font.id as ThemeConfig["fontFamily"])}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.375rem 0.5rem", borderRadius: "0.25rem", cursor: "pointer",
                background: theme.fontFamily === font.id ? "rgba(255,255,255,0.06)" : "transparent",
                border: theme.fontFamily === font.id ? `1px solid ${theme.accentColor}30` : "1px solid transparent",
              }}
            >
              <span style={{ fontFamily: font.family, fontSize: "0.75rem", color: theme.fontFamily === font.id ? "#e4e4e7" : "#71717a" }}>
                {font.label}
              </span>
              <span style={{ fontFamily: font.family, fontSize: "0.625rem", color: "#3f3f46" }}>
                0123456789
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cursor Style */}
      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Cursor Style</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["block", "bar", "underline"] as const).map((style) => (
            <button
              key={style}
              onClick={() => update("cursorStyle", style)}
              style={{
                ...MONO, fontSize: "0.6875rem", padding: "0.375rem 0.75rem",
                borderRadius: "0.25rem", cursor: "pointer",
                background: theme.cursorStyle === style ? "rgba(255,255,255,0.06)" : "transparent",
                border: theme.cursorStyle === style ? `1px solid ${theme.accentColor}30` : "1px solid rgba(255,255,255,0.06)",
                color: theme.cursorStyle === style ? "#e4e4e7" : "#71717a",
              }}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Accent Color</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => update("accentColor", color.value)}
              title={color.name}
              style={{
                width: "1.5rem", height: "1.5rem", borderRadius: "50%",
                background: color.value, border: theme.accentColor === color.value ? "2px solid #e4e4e7" : "2px solid transparent",
                cursor: "pointer", transition: "border-color 150ms",
              }}
            />
          ))}
        </div>
      </div>

      {/* Window Opacity */}
      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Window Opacity</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="range" min={50} max={100} step={5}
            value={theme.opacity}
            onChange={(e) => update("opacity", parseInt(e.target.value))}
            style={{ flex: 1, accentColor: theme.accentColor }}
          />
          <span style={{ ...MONO, fontSize: "0.75rem", color: "#a1a1aa", fontVariantNumeric: "tabular-nums", minWidth: "2.5rem" }}>
            {theme.opacity}%
          </span>
        </div>
      </div>
    </div>
  );
}
