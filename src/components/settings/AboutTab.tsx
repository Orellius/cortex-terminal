import { type JSX } from "react";

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function AboutTab(): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ marginBottom: "0.25rem" }}>
        <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>Cortex</div>
        <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginTop: "0.25rem" }}>
          AI-first multi-model terminal by Orellius Labs
        </div>
      </div>

      <div style={CARD}>
        <InfoRow label="Version" value="2.0.0-dev" />
        <InfoRow label="Stack" value="Tauri 2.0 + React 19 + xterm.js 6" />
        <InfoRow label="Runtime" value="Rust + TypeScript" />
        <InfoRow label="Config" value="~/.cortex/config.toml" />
        <InfoRow label="Identity" value="~/.cortex/identity.md" />
        <InfoRow label="Database" value="SQLite (Tauri app data)" />
      </div>

      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Models</div>
        <InfoRow label="Claude" value="Via CLI (claude -p)" />
        <InfoRow label="Ollama" value="Via /api/chat (local)" />
        <InfoRow label="Routing" value="Complexity scoring (0-10)" />
      </div>

      <div style={CARD}>
        <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>Links</div>
        <InfoRow label="Website" value="orellius.ai" />
        <InfoRow label="GitHub" value="github.com/Orellius/cortex" />
        <InfoRow label="Author" value="Orel — @Orellius" />
      </div>

      <div style={{ ...MONO, fontSize: "0.5625rem", color: "#27272a", textAlign: "center", marginTop: "0.5rem" }}>
        Built with Tauri, Rust, and React. Powered by multiple LLMs.
      </div>
    </div>
  );
}

const CARD: React.CSSProperties = {
  padding: "0.75rem",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.375rem",
  background: "rgba(255,255,255,0.02)",
};

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", ...MONO, fontSize: "0.6875rem" }}>
      <span style={{ color: "#71717a" }}>{label}</span>
      <span style={{ color: "#a1a1aa" }}>{value}</span>
    </div>
  );
}
