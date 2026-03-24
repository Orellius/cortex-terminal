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
5. **LLM configuration** — add/remove model providers: Ollama (local), OpenAI, Anthropic, custom endpoints. Store in `~/.cortex/config.toml`. Auto-detect installed CLIs (ollama, claude, etc.) and connected API keys on first launch.
6. **Persist settings** — Rust reads/writes `~/.cortex/config.toml`, React reads on boot
7. **Contextual status bar** — status bar hidden by default. Appears when: AI is active/processing, user hovers bottom edge, or AI feature is invoked. Contains LLM dropdown picker (switch models mid-session), usage stats, git branch. When no AI connected, shows minimal "connect LLM" prompt instead of empty stats.

### Phase B.5: Content Panels
6. **Markdown reader sidebar** — when user opens/cats a `.md` file, or triggers via Cmd+M, a right-side panel slides open showing the rendered markdown with rich text (headings, code blocks, lists, links, tables). Only available in single-pane or 2x2 grid layouts (not in 3+ col splits — no space). Sidebar is resizable, dismissible with Escape. Uses a React markdown renderer (react-markdown + rehype). Rust detects `.md` file access in CWD or parses `cat *.md` output to auto-suggest opening the reader.
7. **Clickable file paths in terminal** — `.md` files (and other recognized file types) appearing in terminal output (from `ls`, `find`, `git status`, etc.) are clickable. Cmd+click on a `.md` path opens it in the markdown reader sidebar. Cmd+click on other files opens in default editor. Uses xterm's link provider API to detect file paths via regex, verified against filesystem existence in Rust before activating the link.

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
