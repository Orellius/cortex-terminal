<div align="center">

<img src="docs/screenshots/01-welcome.png" alt="Polyterm" width="720" />

# Polyterm

One terminal. Claude for the hard stuff, Ollama for the cheap stuff, your actual shell for everything else.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

> Open to contributors. The core works; several UI-level features are wired partway. If you want to pick one up, skip to [Help Wanted](#help-wanted).

## Why this exists

I kept bouncing between three surfaces: Claude Code for real coding questions, `ollama run llama3` for "just tell me the right flag," and my regular shell for running things. Each had a reason to exist and none of them talked to each other.

Polyterm (formerly cTerminal / Cortex) collapses those into one window. It picks the right model per question, streams the answer into the same pane as your shell output, and keeps a real PTY underneath so you can still just type `git push`.

- `!` prefix runs shell commands inline in chat
- `/` opens slash commands
- Plain text routes to Claude or Ollama based on a complexity scorer
- `c:` / `s:` / `l:` force the tier
- MCP servers plug in for tool support

## What's in it

**Routing.** Deterministic scorer (no ML). Code keywords +5, research +3, syntax +5. Sends hard queries to Claude, medium to Sonnet/Haiku, simple to your local Ollama. Forceable with prefix.

**Streaming.** Token-by-token from Claude (stdout pipe) and Ollama (NDJSON). No waiting on the full response.

**Context.** Before every query, Polyterm reads cwd, `git status`, `CLAUDE.md`, and the project file tree. Responses land in the shape of the project.

**Real PTY.** xterm.js v6 + portable-pty. Split panes (vertical + horizontal). Tabs. Session persistence.

**MCP bridge.** Starts the servers you configure, discovers their tools, injects tool descriptions into the system prompt.

**Memory.** Last 20 messages per tab go to SQLite, restored on relaunch.

**Budget meter.** Daily cost cap on Claude; if you blow past it, routing falls back to Ollama automatically.

**Slash commands.** `/clear`, `/help`, `/model`, `/settings`, `/search`, `/palette`, `/budget`.

**Markdown.** KaTeX for LaTeX, tables, syntax-highlighted code blocks.

**Keyboard.** `Cmd+F` search, `Cmd+Shift+P` palette, `Cmd+K` project launcher (scans `~/Projects` for git repos), `Ctrl+`` quake toggle, `Cmd+Shift+H` paste history.

**Settings.** 9 tabs: Models, Providers, Routing, Budget, Permissions, MCP, Appearance, Shortcuts, About.

## Architecture

Entry: `src-tauri/src/lib.rs::run()` sets up Tauri with PTY, MCP bridge, and config state each wrapped in `Arc<Mutex<>>`.

```
Input  ->  App.tsx (tabs, panes, status polling)
             |
             | Tauri IPC
             v
           src-tauri/src/
             pty.rs              PTY spawn / resize / kill
             ai/router.rs        scores query, picks provider
             ai/providers.rs     stream_claude / stream_ollama / execute_gemini
             ai/mcp.rs           MCP stdio JSON-RPC
             ai/brain.rs         system prompt from ~/.cortex/identity.md
             ipc_server.rs       future CLI bridge (skeleton only)
             SQLite              app_data_dir()/cortex.db
```

## Run it

```sh
git clone https://github.com/Orellius/polyterm
cd polyterm
pnpm install
pnpm tauri dev
```

Needs: Rust stable, Node 20+, pnpm. For Ollama routing install [Ollama](https://ollama.com). For Claude routing install the `claude` CLI and log in.

Release build:

```sh
pnpm tauri build
```

Tests:

```sh
pnpm build            # includes tsc --noEmit
cargo test            # in src-tauri/
```

## Help Wanted

These are the specific places where more hands would move the needle:

1. **Wire Gemini to the UI.** `ProviderKind::Gemini` + `execute_gemini()` exist in the router but `ProvidersTab.tsx` has no API-key input. Add the input, a test button, and the router tier. (Medium.)
2. **Per-role model routing.** `ModelsTab.tsx` lists 8 roles (coding, debugging, research, reasoning, writing, quick, security, data) but there's a TODO at the top saying the router only consults one global `claude_model`. Extend `CortexConfig` with a role → model map, refactor `route_query()`, persist in settings. (Hard.)
3. **Markdown preview sidebar.** `/preview` was in the old README but no component exists. Detect `.md` paths in responses or shell output, render in a right pane using the existing KaTeX + markdown renderer. (Medium.)
4. **Budget viz.** `BudgetTab` shows the cap but no history. Query per-day spend from the DB, render a 7-day bar chart with the cap overlaid. (Easy.)
5. **MCP auto-import.** `import_mcp_from_claude_config()` is already implemented as a Tauri command but `McpTab` has no button. Add a button + preview modal. (Easy.)
6. **Windows + Linux verification.** The codebase should port cleanly via `portable-pty` but nobody has actually run it on Windows. Try it, file issues for whatever breaks, update CONTRIBUTING.md. (Medium.)

Pick one, open an issue, and we'll scope it together.

## Contributing

Conventional Commits. Files capped around 300 lines. `cargo fmt`, `cargo clippy -- -D warnings`, `pnpm typecheck` green before pushing. No hardcoded colors; Tailwind tokens only.

## License

[MIT](LICENSE).
