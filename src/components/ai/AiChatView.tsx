import { useState, useEffect, useRef, useCallback, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AiMessage, type ChatMessage } from "./AiMessage";
import { AiChatInput } from "./AiChatInput";
import { AiThinkingIndicator } from "./AiThinkingIndicator";
import { MarkdownSidebar } from "./MarkdownSidebar";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import watermark from "../../assets/cortex-watermark.png";

interface AiStreamEvent {
  pane_id: string;
  provider: string;
  model: string;
  chunk: string;
  done: boolean;
  cost: number;
  duration_ms: number;
  verified: boolean;
}

interface AiChatViewProps {
  paneId: string;
  isActive: boolean;
}

export function AiChatView({ paneId, isActive }: AiChatViewProps): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState<{ provider: string; startTime: number } | null>(null);
  const [sidebarFile, setSidebarFile] = useState<string | null>(null);
  const [sidebarContent, setSidebarContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationId = useRef<string | null>(null);

  const openMarkdownFile = useCallback((filePath: string) => {
    setSidebarFile(filePath);
    setSidebarContent(null);
  }, []);

  const openMarkdownContent = useCallback((content: string) => {
    setSidebarFile(null);
    setSidebarContent(content);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarFile(null);
    setSidebarContent(null);
  }, []);

  // Create conversation on mount
  useEffect(() => {
    invoke<string>("create_conversation", { tabId: paneId })
      .then((id) => { conversationId.current = id; })
      .catch(() => {});
  }, [paneId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus management
  useEffect(() => {
    if (!isActive) return;
    // Re-focus input when tab becomes active
  }, [isActive]);

  // Listen for AI stream responses
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<AiStreamEvent>("cortex:ai:stream", (event) => {
      const d = event.payload;
      if (d.pane_id !== paneId) return;
      if (!d.done) return;

      // Notify if response took >10s and window not focused
      if (d.duration_ms > 10000 && !document.hasFocus()) {
        const preview = d.chunk.slice(0, 80).replace(/\n/g, " ");
        isPermissionGranted().then((granted) => {
          if (!granted) { requestPermission().catch(() => {}); return; }
          sendNotification({
            title: "Cortex — Response Ready",
            body: preview,
          });
        }).catch(() => {});
      }

      setThinking(null);

      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: d.chunk,
        provider: d.provider,
        model: d.model,
        cost: d.cost,
        durationMs: d.duration_ms,
        verified: d.verified,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, msg]);

      // Persist assistant message
      if (conversationId.current) {
        invoke("add_message", {
          msg: {
            conversation_id: conversationId.current,
            role: "assistant",
            content: d.chunk,
            provider: d.provider,
            model: d.model,
            cost_usd: d.cost,
            duration_ms: d.duration_ms,
            verified: d.verified,
            created_at: new Date().toISOString(),
          },
        }).catch(() => {});
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [paneId]);

  const handleSubmit = useCallback(
    (text: string) => {
      // Shell escape: ! prefix
      if (text.startsWith("!")) {
        // TODO: wire shell execution for chat view
        return;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Persist user message
      if (conversationId.current) {
        invoke("add_message", {
          msg: {
            conversation_id: conversationId.current,
            role: "user",
            content: text,
            provider: null,
            model: null,
            cost_usd: 0,
            duration_ms: 0,
            verified: true,
            created_at: new Date().toISOString(),
          },
        }).catch(() => {});
      }

      // Detect provider for thinking indicator
      const provider = detectProvider(text);
      setThinking({ provider, startTime: Date.now() });

      // Send to AI backend with conversation history
      invoke("send_ai_query", {
        query: text,
        paneId,
        conversationId: conversationId.current,
      }).catch((err: unknown) => {
        setThinking(null);
        const errMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${errMsg}`,
            provider: "system",
            timestamp: Date.now(),
          },
        ]);
      });
    },
    [paneId]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        position: "relative",
        background: "#09090b",
      }}
    >
      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "40%",
          maxWidth: "24rem",
          opacity: 0.04,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src={watermark}
          alt=""
          style={{ width: "100%", objectFit: "contain", objectPosition: "top center" }}
        />
      </div>

      {/* Messages area — scrollable */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0.75rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {messages.length === 0 && !thinking && (
          <div
            style={{
              color: "#27272a",
              fontFamily: '"Geist Mono", Menlo, monospace',
              fontSize: "0.75rem",
              lineHeight: 1.8,
              marginTop: "2rem",
            }}
          >
            <div style={{ color: "#3f3f46", fontWeight: 600, marginBottom: "0.25rem" }}>
              Cortex AI Terminal
            </div>
            <div>Type naturally. Models route automatically.</div>
            <div>Prefix ! for shell commands.</div>
            <div style={{ marginTop: "0.5rem" }}>
              <span style={{ color: "#3f3f46" }}>c:</span> Claude{" "}
              <span style={{ color: "#3f3f46" }}>g:</span> Gemini{" "}
              <span style={{ color: "#3f3f46" }}>l:</span> Local
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <AiMessage
            key={msg.id}
            message={msg}
            onOpenFile={openMarkdownFile}
            onOpenContent={openMarkdownContent}
          />
        ))}

        {thinking && (
          <AiThinkingIndicator
            provider={thinking.provider}
            startTime={thinking.startTime}
          />
        )}
      </div>

      {/* Fixed input at bottom */}
      <AiChatInput onSubmit={handleSubmit} disabled={thinking !== null} />

      {/* Markdown sidebar */}
      <MarkdownSidebar
        filePath={sidebarFile}
        content={sidebarContent}
        onClose={closeSidebar}
      />
    </div>
  );
}

/** Detect which provider will handle this query (for thinking indicator) */
function detectProvider(query: string): string {
  const lower = query.toLowerCase();
  if (lower.startsWith("claude:") || lower.startsWith("c:")) return "claude";
  if (lower.startsWith("gemini:") || lower.startsWith("g:")) return "claude";
  if (lower.startsWith("local:") || lower.startsWith("l:")) return "local";

  const words = lower.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, ""));

  const codeWords = [
    "implement", "build", "fix", "debug", "refactor", "deploy", "publish",
    "commit", "compile", "migration", "scaffold", "architect", "optimize",
  ];
  if (codeWords.some((kw) => words.includes(kw))) return "claude";

  const codeCtx = [
    "bug", "error", "crash", "feature", "function", "component", "endpoint",
    "api", "route", "schema", "test", "cargo", "npm", "git", "rust", "typescript",
  ];
  if (codeCtx.some((kw) => words.includes(kw))) return "claude";

  if (/```|fn |function |class |import |async |struct |pub |const /.test(lower)) return "claude";
  if (/\.(rs|ts|tsx|js|py|toml)\b/.test(lower)) return "claude";

  const researchWords = [
    "explain", "compare", "analyze", "research", "summarize",
    "alternative", "competitor", "trend", "review", "difference",
  ];
  if (researchWords.some((kw) => words.includes(kw))) return "claude";
  if (/what is|how does|how to|pros and cons|difference between/.test(lower)) return "claude";

  return "ollama";
}
