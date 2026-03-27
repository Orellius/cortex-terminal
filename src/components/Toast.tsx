import { useState, useEffect, useCallback, type JSX } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  body: string;
  type: "info" | "update" | "warning" | "error";
  action?: { label: string; onClick: () => void };
  dismiss?: { label: string };
  autoDismissMs?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  info: "#52525b",
  update: "#10b981",
  warning: "#f59e0b",
  error: "#f43f5e",
};

const MONO: React.CSSProperties = { fontFamily: '"Geist Mono", Menlo, monospace' };

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps): JSX.Element {
  return (
    <div style={{
      position: "fixed", bottom: "3.5rem", right: "1rem", zIndex: 150,
      display: "flex", flexDirection: "column-reverse", gap: "0.5rem",
      maxWidth: "22rem", pointerEvents: "none",
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }): JSX.Element {
  const [visible, setVisible] = useState(false);
  const color = TYPE_COLORS[toast.type] ?? "#52525b";

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (toast.autoDismissMs) {
      const timer = setTimeout(onDismiss, toast.autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [toast.autoDismissMs, onDismiss]);

  return (
    <div style={{
      pointerEvents: "auto",
      background: "#0d0d0d", border: `1px solid ${color}30`,
      borderRadius: "0.375rem", padding: "0.625rem 0.75rem",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(0.5rem)",
      transition: "opacity 200ms, transform 200ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
        <span style={{ color, fontSize: "0.5rem" }}>●</span>
        <span style={{ ...MONO, fontSize: "0.6875rem", color: "#e4e4e7", fontWeight: 500 }}>{toast.title}</span>
        <span style={{ flex: 1 }} />
        <button onClick={onDismiss} style={{ ...MONO, fontSize: "0.5rem", color: "#3f3f46", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ ...MONO, fontSize: "0.625rem", color: "#71717a", marginBottom: toast.action ? "0.5rem" : 0 }}>
        {toast.body}
      </div>
      {toast.action && (
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <button
            onClick={() => { toast.action?.onClick(); onDismiss(); }}
            style={{ ...MONO, fontSize: "0.5625rem", fontWeight: 600, background: color, color: "#010101", border: "none", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer" }}
          >
            {toast.action.label}
          </button>
          <button
            onClick={onDismiss}
            style={{ ...MONO, fontSize: "0.5625rem", background: "none", color: "#52525b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", cursor: "pointer" }}
          >
            {toast.dismiss?.label ?? "Skip"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Hook to manage toast state */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
