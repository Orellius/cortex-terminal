# Cortex v2 Roadmap — AI-First Terminal

**Status:** Private repo, polish complete. Building toward open source.
**Last Updated:** 2026-03-24

## User-Requested Features (Orel, 2026-03-24)

1. **Tabs** — multiple terminal sessions with tab bar
2. **Parallel workspace modal** — modal that asks for grid size (2x1, 2x2, etc.) and spawns multiple terminals in a grid layout within a single tab
3. **Settings button** — top-right of title bar, opens settings panel
4. **LLM connections button** — top-right, configure which models to use (Ollama local, API keys for cloud)
5. **Autocomplete** — AI-powered command suggestions as ghost text

## Build Order (Next Sessions)

### Phase A: Foundation for Multi-Terminal
1. **Tab system** — tab bar above terminal, Cmd+T new tab, Cmd+W close, Cmd+1-9 switch
2. **Grid workspace** — modal on new tab: pick layout (single, 2-col, 2x2, 3-col), spawns PTY per pane
3. **Fix split panes** — PaneLayout + TerminalPane already exist but are unused. Wire them into grid layout with explicit pixel dimensions (not flex — learned the hard way)

### Phase B: Settings & Configuration
4. **Settings panel** — slide-out or modal: font size, theme, scrollback, keybindings
5. **LLM configuration** — add/remove model providers: Ollama (local), OpenAI, Anthropic, custom endpoints. Store in `~/.cortex/config.toml`
6. **Persist settings** — Rust reads/writes `~/.cortex/config.toml`, React reads on boot

### Phase C: AI Integration (Local-First)
7. **Shell integration hooks** — inject precmd/preexec hooks into zsh to detect command start/end, exit codes. This enables command blocks and error detection.
8. **Command blocks** — group each command + output into a discrete visual block. Collapsible, copyable, referenceable.
9. **Autocomplete (ghost text)** — local model (Ollama 3B) suggests completions as dimmed text. Tab to accept. Based on history + man pages.
10. **Error autopsy** — on non-zero exit, inline explanation + suggested fix below the block. One keypress to apply.

### Phase D: Advanced AI
11. **Natural language mode** — `# describe what you want` translates to shell command
12. **Output summarization** — long outputs get a 2-line summary badge
13. **Dangerous command guardrails** — intercept rm -rf, DROP TABLE, force push with confirmation

### Phase E: Open Source Prep
14. README, LICENSE (MIT), CONTRIBUTING.md
15. CI/CD (GitHub Actions: cargo check, tsc, clippy)
16. Strip all hardcoded paths, test on Linux
17. Homebrew/cask formula
18. Landing page

## Architecture Notes
- Every AI feature runs in a separate process/thread — never blocks rendering
- Local models via Ollama (already installed on user's machine)
- Cloud models optional, explicit consent per query
- All config in `~/.cortex/` (TOML)
- WASM plugin system deferred to v3
