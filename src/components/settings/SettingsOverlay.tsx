import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, Plug, GitBranch, Wallet, Shield, Zap, Paintbrush, Keyboard, Info } from "lucide-react";
import { ProvidersTab } from "./ProvidersTab";
import { ModelsTab } from "./ModelsTab";
import { BudgetTab } from "./BudgetTab";
import { PermissionsTab } from "./PermissionsTab";
import { McpTab } from "./McpTab";
import { ThemeTab } from "./ThemeTab";
import { AboutTab } from "./AboutTab";

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
}

type SettingsSection = "models" | "providers" | "routing" | "budget" | "permissions" | "mcp" | "theme" | "shortcuts" | "about";

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  group: "ai" | "system";
}

const ICON_PROPS = { size: 14, strokeWidth: 1.5, color: "currentColor" } as const;

const NAV_ITEMS: NavItem[] = [
  { id: "models", label: "Models", icon: <Cpu {...ICON_PROPS} />, group: "ai" },
  { id: "providers", label: "Providers", icon: <Plug {...ICON_PROPS} />, group: "ai" },
  { id: "routing", label: "Routing", icon: <GitBranch {...ICON_PROPS} />, group: "ai" },
  { id: "budget", label: "Budget", icon: <Wallet {...ICON_PROPS} />, group: "ai" },
  { id: "permissions", label: "Permissions", icon: <Shield {...ICON_PROPS} />, group: "system" },
  { id: "mcp", label: "MCP Servers", icon: <Zap {...ICON_PROPS} />, group: "system" },
  { id: "theme", label: "Appearance", icon: <Paintbrush {...ICON_PROPS} />, group: "system" },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard {...ICON_PROPS} />, group: "system" },
  { id: "about", label: "About", icon: <Info {...ICON_PROPS} />, group: "system" },
];

interface SettingsOverlayProps {
  onClose: () => void;
}

export function SettingsOverlay({ onClose }: SettingsOverlayProps): JSX.Element {
  const [active, setActive] = useState<SettingsSection>("models");
  const [config, setConfig] = useState<CortexConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    invoke<CortexConfig>("get_ai_config").then(setConfig).catch(() => {});
  }, []);

  const handleSave = useCallback(async (updated: CortexConfig) => {
    setSaving(true);
    setSaveMsg("");
    try {
      await invoke("update_ai_config", { newConfig: updated });
      setConfig(updated);
      setSaveMsg("saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveMsg(`error: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Budget only relevant when paid APIs are configured (not for local LLMs or CLI subscriptions)
  const hasApi = config?.gemini_api_key != null;
  const aiItems = NAV_ITEMS.filter((n) => n.group === "ai" && (n.id !== "budget" || hasApi));
  const sysItems = NAV_ITEMS.filter((n) => n.group === "system");

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(56rem, 92vw)", height: "min(40rem, 85vh)", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", display: "flex", overflow: "hidden", fontFamily: '"Geist Sans", -apple-system, sans-serif' }}>
        {/* ── Sidebar ── */}
        <div style={{ width: "12rem", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", padding: "0.75rem 0" }}>
          {/* Header */}
          <div style={{ padding: "0 0.75rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...MONO, fontSize: "0.75rem", fontWeight: 600, color: "#e4e4e7" }}>Settings</span>
            {saveMsg && <span style={{ ...MONO, fontSize: "0.5625rem", color: saveMsg === "saved" ? "#10b981" : "#f43f5e" }}>{saveMsg}</span>}
          </div>

          {/* AI Section */}
          <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", padding: "0.5rem 0.75rem 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI</div>
          {aiItems.map((item) => (
            <NavButton key={item.id} item={item} active={active === item.id} onClick={() => setActive(item.id)} />
          ))}

          {/* System Section */}
          <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", padding: "0.75rem 0.75rem 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>System</div>
          {sysItems.map((item) => (
            <NavButton key={item.id} item={item} active={active === item.id} onClick={() => setActive(item.id)} />
          ))}

          {/* Spacer + close */}
          <div style={{ flex: 1 }} />
          <div style={{ padding: "0 0.75rem" }}>
            <button onClick={onClose} style={{ ...MONO, fontSize: "0.625rem", color: "#3f3f46", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0" }}>
              Esc to close
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.25rem 1.5rem" }}>
          {config === null ? (
            <div style={{ color: "#52525b", fontSize: "0.75rem" }}>Loading...</div>
          ) : active === "models" ? (
            <ModelsTab config={config} onSave={handleSave} saving={saving} />
          ) : active === "providers" ? (
            <ProvidersTab config={config} onSave={handleSave} saving={saving} />
          ) : active === "routing" ? (
            <RoutingInfo />
          ) : active === "budget" ? (
            <BudgetTab config={config} onSave={handleSave} saving={saving} />
          ) : active === "permissions" ? (
            <PermissionsTab />
          ) : active === "mcp" ? (
            <McpTab />
          ) : active === "theme" ? (
            <ThemeTab />
          ) : active === "shortcuts" ? (
            <ShortcutsInfo />
          ) : (
            <AboutTab />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Nav Button ─────────────────────────────────────

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.375rem 0.75rem", margin: "0 0.375rem",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", borderRadius: "0.375rem",
        color: active ? "#e4e4e7" : "#71717a",
        ...MONO, fontSize: "0.6875rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer", transition: "color 100ms, background 100ms",
        textAlign: "left",
      }}
    >
      <span style={{ width: "1rem", display: "flex", alignItems: "center", justifyContent: "center", opacity: active ? 1 : 0.5 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

// ─── Routing Info (static) ──────────────────────────────────

function RoutingInfo(): JSX.Element {
  const tiers = [
    { icon: "◆", name: "Claude", color: "#8b5cf6", threshold: "Score 5+", signals: ["Code actions: fix, build, debug, refactor, deploy", "Code syntax: fn, function, class, import, struct", "File refs: .rs, .ts, .tsx, .js, .py"] },
    { icon: "◈", name: "Sonnet", color: "#a78bfa", threshold: "Score 3-4", signals: ["Research: explain, compare, analyze, summarize", "Questions: what is, how does, how to"] },
    { icon: "●", name: "Local", color: "#10b981", threshold: "Score 0-2", signals: ["Short queries, greetings, simple questions", "Default fallback when no signals match"] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SectionHeader title="Smart Routing" description="Queries scored 0-10 by word signals, routed to best tier. Force with c: s: l: prefixes." />
      {tiers.map((t) => (
        <div key={t.name} style={{ ...CARD, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: t.color, fontSize: "0.75rem" }}>{t.icon}</span>
            <span style={{ color: t.color, fontWeight: 600, ...MONO, fontSize: "0.75rem" }}>{t.name}</span>
            <span style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginLeft: "auto" }}>{t.threshold}</span>
          </div>
          {t.signals.map((s, i) => (
            <div key={i} style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", paddingLeft: "1.25rem" }}>{s}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Shortcuts Info ─────────────────────────────────────────

function ShortcutsInfo(): JSX.Element {
  const groups = [
    { title: "Tabs", shortcuts: [["New AI Tab", "Cmd+T"], ["New Shell Tab", "Cmd+Shift+T (undo close)"], ["Close Tab", "Cmd+W"], ["Switch Tab", "Cmd+1-9"]] },
    { title: "Panes", shortcuts: [["Split Vertical", "Cmd+D"], ["Split Horizontal", "Cmd+Shift+D"]] },
    { title: "Window", shortcuts: [["Toggle Cortex", "Ctrl+`"], ["Settings", "Cmd+,"], ["Projects", "Cmd+K"]] },
    { title: "Input", shortcuts: [["Submit", "Enter"], ["New Line", "Shift+Enter"], ["Paste History", "Cmd+Shift+H"]] },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SectionHeader title="Keyboard Shortcuts" description="Global and per-pane keybindings." />
      {groups.map((g) => (
        <div key={g.title} style={CARD}>
          <div style={{ ...MONO, fontSize: "0.6875rem", color: "#71717a", fontWeight: 500, marginBottom: "0.5rem" }}>{g.title}</div>
          {g.shortcuts.map(([action, key]) => (
            <div key={action} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", ...MONO, fontSize: "0.6875rem" }}>
              <span style={{ color: "#a1a1aa" }}>{action}</span>
              <span style={{ color: "#52525b", background: "rgba(255,255,255,0.04)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", fontSize: "0.625rem" }}>{key}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Shared Styles ──────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

const CARD: React.CSSProperties = {
  padding: "0.75rem",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.375rem",
  background: "rgba(255,255,255,0.02)",
};

function SectionHeader({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>{title}</div>
      <div style={{ ...MONO, fontSize: "0.625rem", color: "#52525b", marginTop: "0.25rem" }}>{description}</div>
    </div>
  );
}
