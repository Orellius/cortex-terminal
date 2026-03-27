import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ProviderEntry {
  name: string;
  endpoint: string;
  api_key_env: string;
  api_key: string | null;
  models: string[];
  enabled: boolean;
  format: string;
  extra_headers: [string, string][];
}

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function ProvidersTab(): JSX.Element {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    invoke<ProviderEntry[]>("get_provider_registry").then(setProviders).catch(() => {});
  }, []);

  const toggleProvider = useCallback((name: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.name === name ? { ...p, enabled: !p.enabled } : p))
    );
  }, []);

  const setApiKey = useCallback((name: string, key: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.name === name ? { ...p, api_key: key || null } : p))
    );
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await invoke("save_provider_registry", { providers });
      setSaveMsg("saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("error");
    } finally {
      setSaving(false);
    }
  }, [providers]);

  const cloudProviders = providers.filter((p) => !p.endpoint.includes("localhost"));
  const localProviders = providers.filter((p) => p.endpoint.includes("localhost"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ ...MONO, fontSize: "0.875rem", fontWeight: 600, color: "#e4e4e7" }}>Providers</div>
          <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", marginTop: "0.125rem" }}>
            {providers.filter((p) => p.enabled).length} enabled / {providers.length} total. Config: ~/.cortex/providers.toml
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {saveMsg && <span style={{ ...MONO, fontSize: "0.5625rem", color: saveMsg === "saved" ? "#10b981" : "#f43f5e" }}>{saveMsg}</span>}
          <button onClick={save} disabled={saving} style={{ ...MONO, fontSize: "0.625rem", fontWeight: 600, background: "#e4e4e7", color: "#010101", border: "none", borderRadius: "0.25rem", padding: "0.3rem 0.625rem", cursor: "pointer" }}>
            {saving ? "..." : "Save"}
          </button>
        </div>
      </div>

      {/* Cloud */}
      <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cloud</div>
      {cloudProviders.map((p) => (
        <ProviderRow key={p.name} provider={p} onToggle={toggleProvider} onSetKey={setApiKey} />
      ))}

      {/* Local */}
      <div style={{ ...MONO, fontSize: "0.5625rem", color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.5rem" }}>Local (free)</div>
      {localProviders.map((p) => (
        <ProviderRow key={p.name} provider={p} onToggle={toggleProvider} onSetKey={setApiKey} />
      ))}
    </div>
  );
}

function ProviderRow({ provider, onToggle, onSetKey }: {
  provider: ProviderEntry;
  onToggle: (name: string) => void;
  onSetKey: (name: string, key: string) => void;
}): JSX.Element {
  const [showKey, setShowKey] = useState(false);
  const isLocal = provider.endpoint.includes("localhost");
  const hasKey = provider.api_key_env && !isLocal;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "0.375rem",
      padding: "0.5rem 0.625rem", borderLeft: `2px solid ${provider.enabled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button onClick={() => onToggle(provider.name)} style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: "0.625rem", color: provider.enabled ? "#10b981" : "#27272a",
        }}>
          {provider.enabled ? "●" : "○"}
        </button>
        <span style={{ ...MONO, fontSize: "0.6875rem", color: provider.enabled ? "#e4e4e7" : "#52525b", fontWeight: 500 }}>
          {provider.name}
        </span>
        {provider.models.length > 0 && (
          <span style={{ ...MONO, fontSize: "0.5rem", color: "#27272a" }}>
            {provider.models.slice(0, 3).join(", ")}{provider.models.length > 3 ? ` +${provider.models.length - 3}` : ""}
          </span>
        )}
        {isLocal && <span style={{ ...MONO, fontSize: "0.5rem", color: "#10b981" }}>free</span>}
      </div>

      {hasKey && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", paddingLeft: "1.125rem" }}>
          <span style={{ ...MONO, fontSize: "0.5rem", color: "#3f3f46", minWidth: "5rem" }}>{provider.api_key_env}</span>
          {showKey ? (
            <input
              value={provider.api_key ?? ""}
              onChange={(e) => onSetKey(provider.name, e.target.value)}
              placeholder="paste key or set env var"
              style={{
                ...MONO, flex: 1, fontSize: "0.5625rem", background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.1875rem",
                padding: "0.1875rem 0.375rem", color: "#a1a1aa", outline: "none",
              }}
            />
          ) : (
            <button onClick={() => setShowKey(true)} style={{
              ...MONO, fontSize: "0.5rem", background: "none",
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.1875rem",
              padding: "0.125rem 0.375rem", color: "#3f3f46", cursor: "pointer",
            }}>
              {provider.api_key ? "***configured" : "set key"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
