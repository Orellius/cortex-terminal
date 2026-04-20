<div align="center">

<img src="docs/screenshots/01-welcome.png" alt="Polyterm" width="720" />

# Polyterm

**A multi-model AI terminal. Claude + Ollama + MCP in one native shell.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-000.svg)](#)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-stable-000?logo=rust)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

</div>

> [!NOTE]
> **This project is open to contributors.** Polyterm (formerly cTerminal / Cortex) has a working routing core, real PTY, settings surface, and MCP bridge, but several UI-level features are stubbed or half-wired. See [Help Wanted](#help-wanted) for concrete tasks.

## What is Polyterm?

Polyterm is a native desktop terminal that replaces your shell with a chat-first AI surface. Ask a question, it routes the query to the right model (Claude for hard coding, Sonnet/Haiku for cheap queries, local Ollama for privacy or cost caps) and streams the answer into the same window as your shell output. `!` prefix still runs real commands. `/` gives slash commands. MCP tool servers plug in.

The mental model: one surface for "do work" and "think about work."

## Features

- **Multi-model routing** - deterministic complexity scorer picks Claude (hard), Sonnet/Haiku (medium), or Ollama local (simple). Force with `c:` / `s:` / `l:` prefixes.
- **Streaming** - token-by-token from Claude (stdout pipe) and Ollama (NDJSON)
- **Context injection** - auto-reads cwd, `git status`, `CLAUDE.md`, project file tree before each query
- **Real PTY** - full shell, split panes (vertical + horizontal), tab session persistence, xterm.js v6
- **MCP bridge** - starts configured MCP servers, discovers tools, injects into system prompt
- **Conversation memory** - last 20 messages per tab persisted to SQLite, restored on relaunch
- **Shell execution inline** - `!ls -la` runs in chat; output becomes context for the next prompt
- **Slash commands** - `/clear`, `/help`, `/model`, `/settings`, `/search`, `/palette`, `/budget`
- **Rich markdown** - LaTeX (KaTeX), tables, code blocks with syntax highlighting
- **Search** - `Cmd+F` in terminal and chat
- **Command palette** - `Cmd+Shift+P` fuzzy actions
- **Budget metering** - daily cost cap for Claude; falls back to Ollama when exceeded
- **Settings surface** - 9 tabs (Models, Providers, Routing, Budget, Permissions, MCP, Appearance, Shortcuts, About)
- **Project launcher** - `Cmd+K` scans git repos in `~/Projects`
- **Global hotkey** - `Ctrl+`` toggles the window quake-style
- **Paste history** - `Cmd+Shift+H` clipboard manager

## Architecture

Entry: `src-tauri/src/lib.rs::run()` sets up Tauri with PTY state, MCP bridge state, config state (each `Arc<Mutex<>>`).

- `pty.rs::PtyManager` - spawn / resize / kill PTY sessions; reader thread pipes output via Tauri IPC
- `ai/router.rs::route_query()` - scores query complexity (code +5, research +3, syntax +5), returns `(ProviderKind, model_name)`
- `ai/providers.rs` - routes to `stream_claude()`, `stream_ollama()`, or `execute_gemini()`
- `ai/mcp.rs::McpBridge` - spawns MCP child processes over stdio JSON-RPC, keeps tool registry, injects descriptions into system prompt
- `ai/brain.rs` - loads system prompt from `~/.cortex/identity.md`, `rules/`, and project-local `.cortex/context.md`
- `App.tsx` - tabs / panes / status polling / settings overlay / startup checks
- `ipc_server.rs` - skeleton for a future CLI bridge (not wired yet)
- SQLite at `app_data_dir()/cortex.db` - conversations, sessions, provider config

## Install from source

```bash
git clone https://github.com/Orellius/polyterm
cd polyterm
pnpm install
pnpm tauri dev
```

Requires: Rust stable, Node 20+, pnpm. For Ollama routing, install [Ollama](https://ollama.com) separately. For Claude routing, install the Claude Code CLI and log in.

## Build a release

```bash
pnpm tauri build
# output: src-tauri/target/release/bundle/dmg/
```

## Tests

```bash
pnpm build            # includes `tsc --noEmit`
cargo test            # in src-tauri/
```

## Help Wanted

Polyterm has a solid core but several UI-level features are stubbed. Starter tasks:

1. **Wire Gemini to the UI** (medium) - `ProviderKind::Gemini` + `execute_gemini()` exist in the router but there's no API-key input in `ProvidersTab.tsx` and no budget tier entry. Add the input, test button, and router tier.
2. **Per-role model routing** (hard) - `ModelsTab.tsx` defines 8 roles (coding, debugging, research, reasoning, writing, quick, security, data) but a TODO at the top of the file notes the router only consults a single global `claude_model`. Extend `CortexConfig` with a role -> model map; refactor `route_query()` to consult it; persist in the settings DB.
3. **Markdown preview sidebar** (medium) - `/preview` was in the old README but no component renders it. Detect `.md` paths in responses or shell output, show parsed markdown in a right pane using the existing KaTeX + markdown renderer.
4. **Budget visualization** (easy) - `BudgetTab` shows the cap but no history. Query per-day spend from the DB, render a 7-day bar chart, overlay the cap threshold.
5. **MCP auto-import UI** (easy) - `import_mcp_from_claude_config()` is implemented as a Tauri command but `McpTab` has no button. Add the button + a preview modal listing parsed servers before confirming.
6. **Windows / Linux PTY verification** (medium) - the codebase should port cleanly via `portable-pty`, but nobody has tested xterm.js + PTY on Windows. Run on both platforms, file issues for quirks, update CONTRIBUTING.md.

## Contributing

- Conventional Commits
- Files capped at ~300 lines per CLAUDE.md conventions
- `cargo fmt`, `cargo clippy -- -D warnings`, `pnpm typecheck` all green before pushing
- No hardcoded colors; use Tailwind tokens

## License

[MIT](LICENSE)
