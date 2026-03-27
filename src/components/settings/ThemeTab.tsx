import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
  permission_mode: string;
  font_size: number;
  accent_color: string;
}

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

const ACCENT_COLORS = [
  { name: "Blue", value: "#05a0ef" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "White", value: "#e4e4e7" },
];

export function ThemeTab(): JSX.Element {
  const [config, setConfig] = useState<CortexConfig | null>(null);
  const [fontSize, setFontSize] = useState(13);
  const [accent, setAccent] = useState("#05a0ef");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    invoke<CortexConfig>("get_ai_config").then((cfg) => {
      setConfig(cfg);
      setFontSize(cfg.font_size || 13);
      setAccent(cfg.accent_color || "#05a0ef");
    }).catch(() => {});
  }, []);

  // Apply theme live as user changes
  useEffect(() => {
    document.documentElement.style.setProperty("--cortex-font-size", `${fontSize}px`);
    document.documentElement.style.setProperty("--cortex-accent", accent);
  }, [fontSize, accent]);

  const save = useCallback(async () => {
    if (!config) return;
    const updated = { ...config, font_size: fontSize, accent_color: accent };
    try {
      await invoke("update_ai_config", { newConfig: updated });
      setConfig(updated);
      setSaved("saved");
      setTimeout(() => setSaved(""), 2000);
    } catch {
      setSaved("error");
    }
  }, [config, fontSize, accent]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>Appearance</div>
          <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", marginTop: "0.125rem" }}>Changes apply live. Save to persist.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {saved && <span style={{ ...MONO, fontSize: "0.5625rem", color: saved === "saved" ? "#10b981" : "#f43f5e" }}>{saved}</span>}
          <button onClick={save} style={{ ...MONO, fontSize: "0.625rem", fontWeight: 600, background: "#e4e4e7", color: "#010101", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.625rem", cursor: "pointer" }}>
            Save
          </button>
        </div>
      </div>

      {/* Font Size */}
      <div style={{ padding: "0.625rem", borderLeft: "2px solid rgba(255,255,255,0.04)" }}>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginBottom: "0.5rem" }}>font-size</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="range" min={10} max={20} step={1}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: accent }}
          />
          <span style={{ ...MONO, fontSize: "0.75rem", color: "#a1a1aa", fontVariantNumeric: "tabular-nums", minWidth: "2.5rem" }}>
            {fontSize}px
          </span>
        </div>
        <div style={{ ...MONO, fontSize: `${fontSize * 0.0625}rem`, color: "#52525b", marginTop: "0.375rem" }}>
          &gt; the quick brown fox jumps over the lazy dog
        </div>
      </div>

      {/* Accent Color */}
      <div style={{ padding: "0.625rem", borderLeft: "2px solid rgba(255,255,255,0.04)" }}>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginBottom: "0.5rem" }}>accent-color</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setAccent(color.value)}
              title={color.name}
              style={{
                width: "1.5rem", height: "1.5rem", borderRadius: "0.25rem",
                background: color.value,
                border: accent === color.value ? "2px solid #e4e4e7" : "2px solid transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
        <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", marginTop: "0.375rem" }}>
          current: <span style={{ color: accent }}>{accent}</span>
        </div>
      </div>

      {/* Preview */}
      <div style={{ padding: "0.625rem", borderLeft: `2px solid ${accent}30` }}>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginBottom: "0.375rem" }}>preview</div>
        <div style={{ ...MONO, fontSize: `${fontSize * 0.0625}rem`, color: "#a1a1aa" }}>
          <span style={{ color: "#3f3f46" }}>&gt;</span> explain how TCP works<br />
          <span style={{ color: accent }}>● sonnet</span><br />
          TCP uses a three-way handshake: <span style={{ color: "#e4e4e7" }}>SYN</span>, <span style={{ color: "#e4e4e7" }}>SYN-ACK</span>, <span style={{ color: "#e4e4e7" }}>ACK</span>.
        </div>
      </div>
    </div>
  );
}
