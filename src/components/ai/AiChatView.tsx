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
  cwd: string;
  showSearch?: boolean;
  onCloseSearch?: () => void;
}

export function AiChatView({ paneId, isActive, cwd, showSearch, onCloseSearch }: AiChatViewProps): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState<{ provider: string; startTime: number } | null>(null);
  const [sidebarFile, setSidebarFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Listen for AI stream responses (supports incremental streaming)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<AiStreamEvent>("cortex:ai:stream", (event) => {
      const d = event.payload;
      if (d.pane_id !== paneId) return;

      // ── Streaming chunk (done: false) ──
      if (!d.done) {
        setThinking(null); // Stop thinking indicator on first chunk
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            // Append to existing streaming message
            return [...prev.slice(0, -1), { ...last, content: last.content + d.chunk }];
          }
          // First chunk — create streaming message
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: d.chunk,
              provider: d.provider,
              model: d.model,
              timestamp: Date.now(),
              streaming: true,
            },
          ];
        });
        return;
      }

      // ── Final event (done: true) — finalize with stats ──
      setThinking(null);

      // Notify if response took >10s and window not focused
      if (d.duration_ms > 10000 && !document.hasFocus()) {
        const preview = d.chunk.slice(0, 80).replace(/\n/g, " ");
        isPermissionGranted().then((granted) => {
          if (!granted) { requestPermission().catch(() => {}); return; }
          sendNotification({ title: "Cortex — Response Ready", body: preview });
        }).catch(() => {});
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          // Finalize streaming message with verified content + stats
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: d.chunk || last.content,
              cost: d.cost,
              durationMs: d.duration_ms,
              verified: d.verified,
              streaming: undefined,
            },
          ];
        }
        // No streaming message — create fresh (non-streaming fallback)
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: d.chunk,
            provider: d.provider,
            model: d.model,
            cost: d.cost,
            durationMs: d.duration_ms,
            verified: d.verified,
            timestamp: Date.now(),
          },
        ];
      });

      // Persist assistant message with final verified content
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
      // Shell escape: ! prefix — execute command and show output inline
      if (text.startsWith("!")) {
        const cmd = text.slice(1).trim();
        if (!cmd) return;

        // Show the command as a user message
        const cmdMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: `!${cmd}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, cmdMsg]);

        // Execute and show result
        invoke<{ stdout: string; stderr: string; exit_code: number }>("execute_shell", {
          command: cmd,
          cwd: cwd || undefined,
        })
          .then((result) => {
            const output = (result.stdout + result.stderr).trim() || "(no output)";
            const exitInfo = result.exit_code !== 0 ? `\n[exit ${result.exit_code}]` : "";
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: output + exitInfo,
                provider: "system",
                model: "shell",
                timestamp: Date.now(),
              },
            ]);
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `shell error: ${errMsg}`,
                provider: "system",
                timestamp: Date.now(),
              },
            ]);
          });
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
        cwd: cwd || undefined,
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
        background: "#010101",
      }}
    >
      {/* Watermark — centered vertically, slightly above center so skull sits above input */}
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "50%",
          transform: "translateX(-50%)",
          width: "60%",
          maxWidth: "36rem",
          opacity: 0.02,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <img
          src={watermark}
          alt=""
          style={{ width: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{
          position: "absolute", top: 0, right: "0.5rem", zIndex: 10,
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.25rem 0.5rem", background: "#1a1a1e",
          border: "1px solid rgba(255,255,255,0.06)", borderTop: "none",
          borderRadius: "0 0 0.375rem 0.375rem",
        }}>
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchQuery(""); onCloseSearch?.(); }
            }}
            placeholder="Find in chat..."
            style={{
              background: "transparent", border: "none", outline: "none", width: "12rem",
              fontFamily: '"Geist Mono", monospace', fontSize: "0.75rem", color: "#d4d4d8",
              padding: "0.125rem 0",
            }}
          />
          {searchQuery && (
            <span style={{ fontFamily: '"Geist Mono", monospace', fontSize: "0.625rem", color: "#52525b" }}>
              {messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length} matches
            </span>
          )}
          <button
            onClick={() => { setSearchQuery(""); onCloseSearch?.(); }}
            style={{ background: "transparent", border: "none", color: "#52525b", cursor: "pointer", fontFamily: '"Geist Mono", monospace', fontSize: "0.75rem", padding: "0 0.125rem", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

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
          <pre style={{ fontFamily: '"Geist Mono", Menlo, monospace', fontSize: "0.45rem", color: "#1c1c1e", lineHeight: 1.1, margin: 0, userSelect: "none", whiteSpace: "pre", letterSpacing: 0 }}>{
`▗▄▄▖ ▗▄▖ ▗▄▄▖ ▗▄▄▄▖▗▄▄▄▖▗▖  ▗▖    ▗▄▄▄▖▗▄▄▄▖▗▄▄▖ ▗▖  ▗▖▗▄▄▄▖▗▖  ▗▖ ▗▄▖ ▗▖
▐▌   ▐▌ ▐▌▐▌ ▐▌  █  ▐▌    ▝▚▞▘       █  ▐▌   ▐▌ ▐▌▐▛▚▞▜▌  █  ▐▛▚▖▐▌▐▌ ▐▌▐▌
▐▌   ▐▌ ▐▌▐▛▀▚▖  █  ▐▛▀▀▘  ▐▌        █  ▐▛▀▀▘▐▛▀▚▖▐▌  ▐▌  █  ▐▌ ▝▜▌▐▛▀▜▌▐▌
▝▚▄▄▖▝▚▄▞▘▐▌ ▐▌  █  ▐▙▄▄▖▗▞▘▝▚▖      █  ▐▙▄▄▖▐▌ ▐▌▐▌  ▐▌▗▄█▄▖▐▌  ▐▌▐▌ ▐▌▐▙▄▄▖`
          }</pre>
        )}

        {messages.map((msg) => {
          const matches = searchQuery
            ? msg.content.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
          return (
            <div key={msg.id} style={{ opacity: searchQuery && !matches ? 0.2 : 1, transition: "opacity 150ms" }}>
              <AiMessage
                message={msg}
                onOpenFile={openMarkdownFile}
                onOpenContent={openMarkdownContent}
              />
            </div>
          );
        })}

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
