# Cortex

**AI-first multi-model terminal. One interface, every model, no switching.**

<p>
  <img src="https://img.shields.io/badge/status-archived-red?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

> [!WARNING]
> **This project is archived and no longer maintained.**
> No further updates, fixes, or support will be provided. The code is left
> here as-is under the MIT license — fork it, modify it, ship it, do whatever
> you want with it. No warranty, no promises.

---

## What it was

A native macOS terminal that put Claude, local Ollama models, and a real PTY shell in one window. Single input, router picks the model based on what you typed, responses stream token-by-token, all models share an MCP tool bridge. No chat bubbles, no robot-avatar sidebar — just a terminal.

Routing was deterministic complexity scoring (not ML): high-signal words like `implement` / `fix` / `refactor` went to Claude, `what is` / `explain` to Sonnet, short lookups to local Ollama. Budget metering with daily cap auto-falls back to local when you blow past spend.

## Providers supported

- **Cloud (26+):** OpenAI, Anthropic, Google Gemini, Mistral, DeepSeek, Groq, xAI, Together, Cerebras, Cohere, Perplexity, Fireworks, AWS Bedrock, Azure, Alibaba Qwen, AI21, Reka, Replicate
- **Local (6+):** Ollama (built-in), LM Studio, llama.cpp, vLLM, LocalAI, Jan.ai

## Features

- Multi-model routing with deterministic complexity scoring
- Streaming responses (SSE / NDJSON)
- Context injection: cwd, git status, CLAUDE.md, stack detection
- Shell execution inline with `!` prefix
- MCP bridge shared across all models
- Split panes, tabs (rename/reorder), command palette, global quake-drop hotkey
- Budget metering with daily cap and local fallback
- SQLite conversation memory (last 20 messages per session)
- LaTeX rendering via KaTeX
- 9-page settings UI

## Stack

Tauri 2.0 · Rust · React 19 · TypeScript · xterm.js v6 · SQLite (rusqlite) · KaTeX · Vite · pnpm

## Quickstart

```bash
git clone https://github.com/Orellius/orellius-cortex-terminal
cd orellius-cortex-terminal
pnpm install
cargo tauri dev    # dev
cargo tauri build  # production .dmg
```

Requires macOS 13+, Rust 1.77+, Node 20+, pnpm 10+, Tauri CLI v2. Claude uses the existing Claude Code CLI OAuth (no API key needed). Ollama connects to `localhost:11434` by default.

## Configuration

All config lives in `~/.cortex/`:

- `config.toml` — models, endpoints, daily budget, permission mode
- `mcp.toml` — MCP server definitions (importable from Claude Code `settings.json`)
- `identity.md` — optional identity prompt prepended to every query

## Architecture in one paragraph

Frontend never talks to AI providers directly. Every call goes through Rust. The router scores the query 0–10, picks a provider, streams tokens back via Tauri events. Context (cwd, git, CLAUDE.md) is injected automatically. MCP tools are discovered on startup and injected into system prompts. PTY runs one thread per pane via `portable-pty`. See `src-tauri/src/ai/` for the routing, provider, and MCP bridge code.

## License

MIT. Fork it, relicense it, rebrand it, ship it as your own — no attribution required, no strings attached.
