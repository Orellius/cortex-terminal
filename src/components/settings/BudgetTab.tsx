import { useState, useEffect, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CortexConfig {
  claude_model: string;
  gemini_model: string;
  gemini_api_key: string | null;
  ollama_model: string;
  ollama_endpoint: string;
  daily_budget_usd: number;
}

interface BudgetStatus {
  spent_today: number;
  limit: number;
  is_capped: boolean;
}

interface BudgetTabProps {
  config: CortexConfig;
  onSave: (config: CortexConfig) => Promise<void>;
  saving: boolean;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontFamily: '"Geist Mono", Menlo, monospace',
  color: "#71717a",
  fontWeight: 500,
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.625rem",
  color: "#e4e4e7",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.75rem",
  outline: "none",
  width: "8rem",
  fontVariantNumeric: "tabular-nums",
};

const BTN_STYLE: React.CSSProperties = {
  background: "#e4e4e7",
  color: "#09090b",
  border: "none",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.75rem",
  fontFamily: '"Geist Mono", Menlo, monospace',
  fontSize: "0.6875rem",
  fontWeight: 600,
  cursor: "pointer",
};

export function BudgetTab({ config, onSave, saving }: BudgetTabProps): JSX.Element {
  const [dailyLimit, setDailyLimit] = useState(config.daily_budget_usd.toString());
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  useEffect(() => {
    invoke<BudgetStatus>("get_budget_status")
      .then(setBudget)
      .catch(() => {});
  }, []);

  const handleSave = useCallback(() => {
    const parsed = parseFloat(dailyLimit);
    if (isNaN(parsed) || parsed < 0) return;
    onSave({ ...config, daily_budget_usd: parsed });
  }, [config, dailyLimit, onSave]);

  const spent = budget?.spent_today ?? 0;
  const limit = budget?.limit ?? config.daily_budget_usd;
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isCapped = budget?.is_capped ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Today's usage */}
      <div
        style={{
          padding: "0.75rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.375rem",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div
          style={{
            fontSize: "0.6875rem",
            fontFamily: '"Geist Mono", Menlo, monospace',
            color: "#71717a",
            marginBottom: "0.625rem",
            fontWeight: 500,
          }}
        >
          Today
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "0.375rem",
            background: "rgba(255, 255, 255, 0.06)",
            borderRadius: "0.25rem",
            overflow: "hidden",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: isCapped ? "#f43f5e" : pct > 80 ? "#f59e0b" : "#10b981",
              borderRadius: "0.25rem",
              transition: "width 300ms ease",
            }}
          />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: '"Geist Mono", Menlo, monospace',
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ color: isCapped ? "#f43f5e" : "#e4e4e7" }}>
            ${spent.toFixed(4)}
          </span>
          <span style={{ color: "#52525b" }}>
            / ${limit.toFixed(2)}
          </span>
        </div>

        {isCapped && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.375rem 0.5rem",
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.2)",
              borderRadius: "0.25rem",
              fontSize: "0.6875rem",
              fontFamily: '"Geist Mono", Menlo, monospace',
              color: "#f43f5e",
            }}
          >
            Budget capped — cloud models disabled, local only
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div
        style={{
          padding: "0.75rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.375rem",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ ...LABEL_STYLE, marginBottom: "0.5rem" }}>Cost breakdown</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            fontSize: "0.6875rem",
            fontFamily: '"Geist Mono", Menlo, monospace',
          }}
        >
          <CostRow icon="◆" color="#8b5cf6" name="Claude" rate="~$15/1M output tokens" />
          <CostRow icon="◈" color="#0ea5e9" name="Gemini" rate="Free (15 RPM limit)" />
          <CostRow icon="●" color="#10b981" name="Local" rate="Free (local compute)" />
        </div>
      </div>

      {/* Daily limit setting */}
      <div
        style={{
          padding: "0.75rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "0.375rem",
          background: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
        }}
      >
        <div style={LABEL_STYLE}>Daily budget limit (USD)</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#52525b", fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.75rem" }}>$</span>
          <input
            style={INPUT_STYLE}
            type="number"
            min="0"
            step="0.5"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
          />
        </div>
        <div
          style={{
            fontSize: "0.625rem",
            fontFamily: '"Geist Mono", Menlo, monospace',
            color: "#52525b",
          }}
        >
          When reached, cloud models are disabled. Only local models respond.
          Set to 0 for unlimited.
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={{ ...BTN_STYLE, opacity: saving ? 0.5 : 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

interface CostRowProps {
  icon: string;
  color: string;
  name: string;
  rate: string;
}

function CostRow({ icon, color, name, rate }: CostRowProps): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <span style={{ color, fontSize: "0.625rem" }}>{icon}</span>
      <span style={{ color, width: "3.5rem" }}>{name}</span>
      <span style={{ color: "#3f3f46" }}>{rate}</span>
    </div>
  );
}
