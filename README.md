# Cortex

**AI-first multi-model terminal. One interface, every model, no switching.**

```
 ██████╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗
██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝
██║     ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝
██║     ██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗
╚██████╗╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗
 ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
```

> Built by [Orel](https://github.com/Orellius) — [orellius.ai](https://orellius.ai)

---

![screenshot placeholder](docs/screenshot.png)

---

## What it is

Cortex is a native desktop terminal that puts Claude, Gemini, and local Ollama models alongside a real shell in one window. You type in a single input. The router decides which model to call based on what you wrote. Responses stream token-by-token. All models share the same MCP tool bridge, so every model can read your filesystem, run shell commands, or call any tool you configure.

There is no chat bubble UI, no sidebar with a robot avatar. Just a terminal.

---

## Features

### Multi-model AI

Three providers run simultaneously. The router picks the right one automatically.

| Provider | Models | When used |
|---|---|---|
| Claude | claude-sonnet (default), claude-opus | Code, debugging, implementation |
| Gemini | gemini-2.0-flash | Research, explanation, comparison |
| Ollama | nemotron-cascade-2 (default), any local model | Simple queries, local-only, budget cap fallback |

Force a provider by prefixing your query:

```
# c: implement a binary search in Rust
# l: what does grep do
# s: explain the difference between Arc and Rc
```

Automatic routing uses deterministic complexity scoring — no ML. Keywords like `implement`, `fix`, `refactor` score high and route to Claude. Questions like `what is` or `explain` route to Gemini. Short lookups route to Ollama.

### Streaming

Responses stream token-by-token from both cloud providers and Ollama. The stream event fires on every chunk via Tauri's `cortex:ai:stream` IPC event. There is no wait for a complete response before rendering.

### Context awareness

Before every AI query, Cortex reads:

- Current working directory
- Git branch and status
- Relevant project files
- `CLAUDE.md` if present in the project root

This context is injected automatically. You do not need to paste file contents into prompts.

### Conversation memory

The last 20 messages per session are persisted to SQLite and included as history on every query. Conversations survive tab switches and app restarts.

### Shell execution

Prefix any message with `!` to run it as a shell command directly inside the AI chat panel:

```
! ls -la
! git status
! cargo check
```

Output appears inline in the AI chat, not in a separate terminal pane.

### Slash commands

| Command | Action |
|---|---|
| `/clear` | Clear current AI conversation |
| `/help` | Show available commands |
| `/model` | Switch active model mid-session |
| `/settings` | Open settings overlay |
| `/search` | Activate search in current pane |
| `/palette` | Open command palette |
| `/budget` | Show today's spend and daily cap |

### Verification gate

Local model (Ollama) outputs pass through a verification layer before display. If the output fails consistency checks, a `[verification failed: ...]` prefix is prepended. Cloud model outputs are marked as verified unconditionally.

### Budget metering

All Claude API calls are cost-estimated and logged to SQLite. When the daily budget cap is reached, the router automatically falls back to Ollama for all queries. The `/budget` command shows current spend vs. the configured limit. Default daily cap: $5.00.

### MCP Bridge

Cortex runs a Model Context Protocol bridge that starts configured MCP servers on launch. All models share the same tool registry — any tool available to Claude is available to Ollama. MCP servers are configured in `~/.cortex/mcp.toml` and can be imported directly from your Claude Code config.

### Terminal

- Full PTY via `portable-pty` — real shell, not a subprocess wrapper
- xterm.js v6 with DOM renderer
- Split panes: `Cmd+D` (vertical), `Cmd+Shift+D` (horizontal)
- Each pane gets its own PTY process
- Shell: inherits `$SHELL` from environment (zsh by default)

### Tab management

- Multiple independent sessions per window
- Tabs labeled `1#`, `2#`, `3#` by session number
- Double-click a tab title to rename it
- Session state persists across quit and relaunch

### Search

`Cmd+F` activates incremental search in both AI chat and shell output. Powered by xterm's `@xterm/addon-search`.

### Command palette

`Cmd+Shift+P` opens a fuzzy command palette with all available actions.

### Global hotkey

`Ctrl+`` ` toggles the window visibility from anywhere on the system (quake-style). Configured via `tauri-plugin-global-shortcut`.

### Settings

Settings overlay opened with `Cmd+,` or `/settings`. Organized into tabs:

| Tab | Contents |
|---|---|
| Models | Active model per provider, model picker |
| Providers | API keys, Ollama endpoint, auto-detected CLIs |
| Routing | Complexity thresholds, provider override defaults |
| Budget | Daily cap in USD, spend history |
| Permissions | Safe / Ask / Auto / Bypass modes |
| MCP Servers | Import from Claude Code, add/remove servers |
| Shortcuts | Keyboard shortcut reference |
| About | Version, build info, links |

### ASCII welcome screen

On first launch, a welcome screen renders in the terminal with session info, detected providers, and available commands.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+T` | New tab |
| `Cmd+W` | Close tab |
| `Cmd+1` – `Cmd+9` | Switch to tab N |
| `Cmd+D` | Split pane vertically |
| `Cmd+Shift+D` | Split pane horizontally |
| `Cmd+F` | Search in current pane |
| `Cmd+Shift+P` | Command palette |
| `Cmd+,` | Open settings |
| `Ctrl+`` ` | Toggle window (global) |
| `Enter` | Submit AI query |
| `Shift+Enter` | Insert newline in AI input |
| `Up` / `Down` | Navigate input history |
| `Escape` | Dismiss overlay / cancel |

---

## Installation

### Prerequisites

- macOS 13+ (Ventura or later)
- [Rust](https://rustup.rs/) 1.77.2+
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/) v2

Optional (for AI features):

- [Claude CLI](https://claude.ai/code) — for Claude provider
- [Ollama](https://ollama.ai/) — for local model provider

### Build from source

```bash
git clone https://github.com/Orellius/cortex
cd cortex

pnpm install
cargo tauri dev
```

Production build:

```bash
cargo tauri build
```

The `.dmg` installer outputs to `src-tauri/target/release/bundle/dmg/`.

---

## Configuration

All config lives in `~/.cortex/`. Created automatically on first launch.

### `~/.cortex/config.toml`

```toml
# Model selection
claude_model = "sonnet"
gemini_model = "gemini-2.0-flash"
ollama_model = "nemotron-cascade-2"

# Provider config
ollama_endpoint = "http://localhost:11434"
gemini_api_key = ""          # optional, leave empty to disable Gemini

# Budget
daily_budget_usd = 5.0

# Permissions: safe | ask | auto | bypass
permission_mode = "ask"
```

### `~/.cortex/mcp.toml`

```toml
[[servers]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects"]

[[servers]]
name = "github"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]
env = { GITHUB_TOKEN = "ghp_..." }
```

Import your existing Claude Code MCP config from Settings > MCP Servers > Import from Claude Code. This reads `~/.claude/mcp.json` and copies the server entries to `~/.cortex/mcp.toml`.

### `~/.cortex/identity.md`

Optional. Write anything here — your name, role, preferred coding style, project context. This file is prepended to every AI query as a system-level identity injection.

---

## Architecture

```
cortex/
├── src/                        # React 19 frontend (presentational only)
│   ├── components/
│   │   ├── ai/                 # AiChatView, AiMessage, AiChatInput, streaming UI
│   │   ├── settings/           # Settings overlay tabs
│   │   ├── TabBar.tsx          # Tab management
│   │   ├── TerminalPane.tsx    # xterm.js wrapper
│   │   ├── StatusBar.tsx       # Provider status, git branch, budget
│   │   └── CommandPalette.tsx
│   ├── hooks/                  # useTerminal, useTabs, useAiStream, useKeyboard
│   ├── types.ts                # Shared TypeScript types
│   └── constants.ts            # Terminal theme, layout constants
│
└── src-tauri/                  # Rust backend
    └── src/
        ├── ai/
        │   ├── router.rs       # Complexity-scored query routing
        │   ├── providers.rs    # Claude CLI, Gemini API, Ollama HTTP
        │   ├── brain.rs        # Context injection (cwd, git, CLAUDE.md)
        │   ├── mcp.rs          # MCP bridge (stdio server management)
        │   ├── verification.rs # Output verification gate
        │   ├── database.rs     # SQLite: conversations, cost log
        │   ├── config.rs       # config.toml + mcp.toml read/write
        │   ├── budget.rs       # Daily spend tracking
        │   └── types.rs        # Rust types, CortexConfig, ProviderKind
        ├── commands/
        │   ├── ai_commands.rs  # Tauri IPC: send_ai_query, get_budget_status
        │   ├── pty_commands.rs # Tauri IPC: spawn_pty, write_pty, resize_pty
        │   ├── chat_commands.rs
        │   └── status_commands.rs
        ├── pty.rs              # PTY manager (portable-pty, one thread per pane)
        └── lib.rs              # Tauri app setup, state registration
```

**IPC contract.** The frontend never talks to AI providers directly. Every AI call goes through `send_ai_query` (Tauri command). The Rust backend owns all provider state, cost tracking, and verification. The frontend receives `cortex:ai:stream` events with typed `AiStreamEvent` payloads.

**Threading model.** Each PTY pane runs a dedicated reader thread. AI calls run in `tokio::task::spawn_blocking` — they never block the PTY thread or the Tauri IPC thread. Streaming chunks are emitted to the frontend as they arrive.

**Persistence.** SQLite via `rusqlite` (bundled). Two tables: `messages` (conversation history) and `cost_log` (per-query spend). Config is TOML on disk, loaded into `Arc<Mutex<CortexConfig>>` at startup and hot-reloaded on settings save.

---

## Roadmap

- [ ] Shell integration hooks (precmd/preexec, command blocks, exit code detection)
- [ ] AI-powered autocomplete as ghost text (Ollama 3B, Tab to accept)
- [ ] Error autopsy — inline explanation on non-zero exit
- [ ] Clickable file paths in terminal output (Cmd+click to open)
- [ ] Markdown reader sidebar (Cmd+M, rendered inline)
- [ ] Natural language mode (`#` prefix, translates to shell command)
- [ ] Dangerous command guardrails (rm -rf, force push, DROP TABLE)
- [ ] Linux support
- [ ] Homebrew cask formula
- [ ] Open source release

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Orel](https://github.com/Orellius) — [@Orellius](https://x.com/Orellius) on X — [orellius.ai](https://orellius.ai)
