# Cortex — AI-First Terminal

## Stack
Tauri 2.0 + React 19 + xterm.js v6 (DOM renderer) + Rust (portable-pty)

## Critical Rules

### xterm.js v6 in Tauri WKWebView
- xterm.css MUST load via `<link>` in index.html — NOT through Vite JS imports
- No Tailwind preflight — breaks xterm DOM renderer
- No global CSS `*` resets — breaks xterm character width measurement
- `.xterm .xterm-scrollable-element { background-color: transparent }` required for watermark
- `.xterm .xterm-helpers { height: 0 }` required to hide measurement elements
- Terminal container needs explicit dimensions (`100vw x 100vh` or computed px) — CSS flex gives xterm zero height at mount time

### Architecture
- No file over 300 lines
- Hooks: one concern per hook (useTerminal, useStatusPoll, useKeyboard, useHomeDir)
- Components: one visual concern per component
- Types in types.ts, constants in constants.ts
- No hardcoded paths — use `get_home_dir` Rust command
- No hardcoded shell — will use `$SHELL` (currently `/bin/zsh`)

### Rust Rules
- No `.unwrap()` or `.expect()` — use anyhow/thiserror
- PTY reader thread never holds manager mutex during I/O
- AI calls must be async, never block PTY or render path
- All Tauri commands return `Result<T, String>` for IPC

### Responsiveness
- Root font-size: `clamp(14px, 10px + 0.625vw, 20px)` on html element
- All UI sizes in rem — auto-scale from root
- Terminal fontSize derived from `getComputedStyle(document.documentElement).fontSize`
- No hardcoded px except 1px borders and xterm internals

### Status
- Repo: github.com/Orellius/cortex (private)
- Planned open source after polish
- Docs: docs/roadmap-v2.md, docs/audit-report-2026-03-24.md, docs/terminal-research-2026-03-24.md
