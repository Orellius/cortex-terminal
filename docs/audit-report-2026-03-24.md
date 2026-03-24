

I now have a complete picture of the entire codebase. Let me produce the audit report.

---

# Cortex Implementation Audit Report

**Date:** 2026-03-24
**Codebase:** ~1,969 lines across 18 source files (7 Rust, 11 TypeScript/TSX)
**Stack:** Tauri 2.10 + React 19 + xterm.js 6 + portable-pty 0.8

---

## 1. CURRENT STATE INVENTORY

### Features Present

| Feature | Description | Quality | Notes |
|---------|-------------|---------|-------|
| **PTY spawning** | Spawns `/bin/zsh` via `portable-pty`, bridges I/O to xterm.js over Tauri events | **Solid** | Clean reader thread, proper kill/cleanup, no mutex held during I/O |
| **Terminal rendering** | xterm.js 6 with Geist Mono, cursor blink, scrollback 5000 | **Solid** | Correct font loading with `document.fonts.ready` gate |
| **Resize handling** | ResizeObserver on container, forwards cols/rows to PTY | **Solid** | Debounced at 16ms, handles teardown edge case |
| **CWD tracking** | Shell reports cwd via OSC title escape sequences | **Fragile** | Depends on shell config emitting OSC 0/2; no fallback if shell does not |
| **Git branch display** | Polls `git rev-parse` every 10s, shows in status bar | **Solid** | Graceful fallback to em-dash on non-git dirs |
| **Claude usage meter** | Reads OAuth token from macOS Keychain, fetches Anthropic usage API | **Fragile** | macOS-only (hardcoded `security` CLI), blocking HTTP in Rust, no caching between polls |
| **Project launcher** | Cmd+K opens modal listing subdirs of `~/Desktop/Orellius/Projects/` | **Fragile** | Hardcoded to one directory, no recency/frecency sorting, no keyboard shortcut to create |
| **In-terminal search** | Cmd+F opens search bar using xterm SearchAddon | **Solid** | Highlights, prev/next navigation, Escape to close |
| **Split panes** | `PaneLayout` + `TerminalPane` components with drag-resize handles | **Fragile** | Components exist but are **unused** -- `App.tsx` renders single `TerminalView`, not `PaneLayout`. No keyboard shortcut to split. Two separate theme definitions (constants.ts vs TerminalPane inline) |
| **Custom title bar** | Tauri overlay title bar with cwd path display | **Solid** | Native drag region, minimal |
| **Status bar** | Branch, usage percentages, `zsh` indicator, Cmd+K hint | **Solid** | Tabular nums, color-coded usage thresholds |
| **Tauri capabilities** | Deny-by-default, explicit event grants for `pty:*` and `session:*` | **Solid** | Follows Tauri v2 security model |

### What Does NOT Exist Yet

- No AI integration of any kind
- No tab system
- No configuration file (no user-editable settings)
- No multi-shell support (hardcoded `/bin/zsh`)
- No theme system (hardcoded dark-only)
- No command history/blocks
- No clipboard integration beyond xterm defaults
- No notifications or alerts
- No update mechanism
- No telemetry or crash reporting
- No tests (zero test files exist)
- No CI/CD pipeline

---

## 2. COMPETITOR FEATURE STEAL LIST

### Warp

1. **Command Blocks** -- Every command + its output is a discrete, selectable, copyable block with a visible boundary. This is the single most impactful UX change any terminal has made in a decade. Cortex should implement this by intercepting shell prompt markers (OSC 133) to segment output into blocks, rendered as React overlays on top of xterm.

2. **`#` AI Mode Toggle** -- Typing `#` at prompt start switches to natural language mode. Simple, zero-friction, discoverable. The key insight: do not build a separate AI panel -- make the prompt itself the AI input. Requires a prompt interceptor in the Rust PTY layer.

3. **Warp Drive (Shared Workflows)** -- Saved command sequences shareable across teams. The open-source equivalent: local TOML/YAML workflow files with a command palette to invoke them. Skip the cloud component.

### Wave

1. **BYOK/BYOLLM Architecture** -- Users bring their own API keys or local models (Ollama, LM Studio). No account, no telemetry. This is the correct privacy-first approach for Cortex. Implement as an adapter protocol with `LocalModel` and `CloudModel` traits in Rust.

2. **Block Workspace Layout** -- Terminal panes coexist with editor panes and browser preview panes in the same window. The insight is not "embed a browser" but "treat non-terminal content as first-class panes." Cortex already has `PaneLayout` -- extend it to support heterogeneous pane types.

3. **Zero-Account Onboarding** -- Wave works immediately with no signup. First-run experience is the terminal itself. Cortex should never require authentication for core terminal functionality. AI features degrade gracefully to local-only.

### Ghostty

1. **Native GPU Rendering at 2ms Latency** -- Ghostty uses Metal directly for sub-3ms frame rendering. While Cortex uses xterm.js (Canvas/WebGL), the lesson is: measure input-to-pixel latency obsessively. Add a latency overlay in dev mode. If xterm.js becomes the bottleneck, the migration path is xterm.js WebGL addon or eventually a custom wgpu renderer.

2. **Kernel-Level PTY Performance** -- Ghostty's Zig-based PTY handling achieves near-zero overhead. Cortex's `portable-pty` with 8KB read buffer is good but could benefit from an adaptive buffer size based on throughput (small for interactive, large for `cat` of big files).

3. **Configuration via Simple Key-Value File** -- No JSON, no TOML nesting, no Lua scripting. Just `font-size = 13`. The simplest config format wins for terminals because users edit config in the terminal itself. Adopt a flat key-value format for Cortex settings.

### iTerm2

1. **Shell Integration Protocol** -- iTerm2's shell integration marks prompt start, command start, command end, and output end with special escape sequences. This is the foundation for command blocks, scrollback navigation, and AI context. Adopt the same FinalTerm/OSC 133 sequences.

2. **Triggers System** -- Regex-based pattern matching on terminal output that fires actions (highlight, alert, run script). This is the low-effort, high-value precursor to AI features. Implement as a Rust-side output scanner running in the PTY reader thread.

3. **Inline Image Display (Sixel/iTerm2 Protocol)** -- Rendering images inline in the terminal. Useful for AI-generated diagrams, `matplotlib` output, file previews. xterm.js has community addons for image protocols.

### Kitty

1. **Kittens Plugin System** -- Python scripts that can create full terminal UIs (like `diff`, `ssh`, `unicode_input`). The design insight: plugins should be able to take over the full terminal viewport temporarily. Cortex's WASM plugin system should support this "full-screen takeover" mode.

2. **Kitty Graphics Protocol** -- The most capable terminal image protocol. Unicode placeholders allow images to reflow with text. If implementing inline images, support Kitty protocol as the primary, iTerm2 as fallback.

3. **Remote Control API** -- Kitty can be controlled from scripts via a socket. Cortex should expose a local IPC socket (Unix domain socket) for scripting and editor integration from day one.

### WezTerm

1. **Lua Configuration** -- Full programmable config. Users write `wezterm.on("format-tab-title", ...)` to customize behavior. The lesson: configuration should be programmable, not just declarative. Cortex's WASM plugin layer can serve this purpose better than embedding a scripting language.

2. **Multiplexer Protocol** -- WezTerm can act as a multiplexer (like tmux) with domains for local, SSH, and container sessions. This means terminal sessions persist across window closes. Cortex should support session persistence via a background daemon.

3. **All Image Protocol Support** -- WezTerm supports Sixel, iTerm2, and Kitty image protocols simultaneously. Be protocol-agnostic; detect and render whatever the application sends.

### Alacritty

1. **Zero-Feature Philosophy as Performance Baseline** -- Alacritty proves that a terminal with no tabs, no splits, and no AI can still get 63K stars through raw speed alone. Cortex must match Alacritty's perceived responsiveness before adding any features. Keystroke-to-display latency is the non-negotiable metric.

2. **TOML Configuration with Live Reload** -- Edit config, save, terminal updates instantly. No restart required. Cortex must have live config reload from day one.

3. **Vi Mode for Scrollback** -- Navigate scrollback buffer with vi keybindings (hjkl, /, n, N). This is beloved by power users and costs very little to implement. xterm.js does not natively support this, but it can be layered as a mode that intercepts keystrokes before PTY forwarding.

---

## 3. AI-FIRST FEATURES -- PRIORITIZED IMPLEMENTATION ORDER

### Tier 1: Foundation (Build These First)

#### 1. Shell Integration / Command Blocks
- **Impact:** 9/10 -- Every subsequent AI feature depends on knowing where commands start and end
- **Feasibility:** High -- OSC 133 is a well-documented protocol
- **Effort:** M

**User-visible:** Each command and its output is a discrete, selectable block with a subtle border. Click to select entire output. Right-click to copy, share, or send to AI.

**Technical:** Rust PTY reader thread scans output for OSC 133 sequences (`;A` = prompt start, `;B` = command start, `;C` = command end, `;D` = output end). Emits structured `pty:block` events to frontend. React renders block boundaries as decorations over xterm viewport. Requires shell integration scripts (injected into `.zshrc` or via `PROMPT_COMMAND`).

**Dependencies:** None -- builds on existing PTY reader
**Files:** `src-tauri/src/shell_integration.rs` (new), modify `src-tauri/src/pty.rs` reader loop, `src/components/CommandBlock.tsx` (new), `src/hooks/useCommandBlocks.ts` (new)

#### 2. Dangerous Command Detection
- **Impact:** 7/10 -- Immediately useful safety net, zero AI infra required
- **Feasibility:** High -- Pattern matching on command text
- **Effort:** S

**User-visible:** When user types `rm -rf /`, `git push --force origin main`, `DROP TABLE`, or `chmod -R 777 /`, a warning banner appears inline before execution. User confirms or cancels.

**Technical:** Rust-side interceptor in PTY write path. A static list of regex patterns matching dangerous commands. When matched, blocks the write and emits a `pty:warning` event. Frontend shows confirmation dialog. On confirm, the original bytes are forwarded to PTY.

**Dependencies:** Shell integration (to know prompt state) is ideal but not required -- can pattern-match on raw input
**Files:** `src-tauri/src/guardrails.rs` (new), modify `src-tauri/src/pty.rs` write method, `src/components/DangerWarning.tsx` (new)

#### 3. Local AI Provider Adapter
- **Impact:** 8/10 -- Unlocks all AI features without cloud dependency
- **Feasibility:** High -- Ollama has a simple HTTP API
- **Effort:** M

**User-visible:** In settings, user points to Ollama endpoint (default `localhost:11434`). Cortex auto-detects available models. All AI features work offline.

**Technical:** Rust `ai` module with a `Provider` trait: `async fn complete(&self, prompt: &str, context: &[Message]) -> Result<String>`. Implementations: `OllamaProvider` (HTTP to local Ollama), `AnthropicProvider` (cloud, opt-in). Provider selection is config-driven. AI calls run on a Tokio task, never blocking PTY or UI.

**Dependencies:** Configuration system (Feature 5)
**Files:** `src-tauri/src/ai/mod.rs`, `src-tauri/src/ai/provider.rs`, `src-tauri/src/ai/ollama.rs`, `src-tauri/src/ai/anthropic.rs` (all new)

#### 4. Configuration System
- **Impact:** 6/10 -- Blocks user customization and AI provider setup
- **Feasibility:** High -- File watching is straightforward in Rust
- **Effort:** S

**User-visible:** `~/.config/cortex/config.toml` with live reload. Change font size, save, terminal updates. Settings include AI provider endpoints, keybindings, theme overrides.

**Technical:** Rust reads TOML on startup, watches file with `notify` crate. On change, re-parses and emits `config:updated` event to frontend. Frontend applies changes without restart. Sensible defaults compiled into binary.

**Dependencies:** None
**Files:** `src-tauri/src/config.rs` (new), `src/hooks/useConfig.ts` (new), add `notify` and `toml` to Cargo.toml

### Tier 2: Intelligence (Build After Foundation)

#### 5. AI Command Suggestions (Inline Ghost Text)
- **Impact:** 9/10 -- The killer feature -- predictive command completion
- **Feasibility:** Medium -- Requires prompt state detection and xterm decoration
- **Effort:** L

**User-visible:** As user types at prompt, dimmed ghost text appears showing the predicted completion. Tab to accept, keep typing to ignore. Predictions come from local model using current directory context, recent commands, and git state.

**Technical:** Frontend detects "at prompt" state via shell integration. On each keystroke (debounced 150ms), sends partial command + context to Rust AI module. Rust queries local model (3B parameter, <50ms target). Response rendered as xterm decoration (dimmed text after cursor). Tab keypress detected in frontend, completes by writing the remaining text to PTY.

**Dependencies:** Shell integration (1), AI provider (3), Configuration (4)
**Files:** `src/hooks/useGhostCompletion.ts` (new), `src-tauri/src/ai/completion.rs` (new), modify `src-tauri/src/commands/` for new AI commands

#### 6. Error Detection + Explanation
- **Impact:** 8/10 -- Every developer hits cryptic errors daily
- **Feasibility:** High -- Pattern matching + LLM explanation
- **Effort:** M

**User-visible:** When a command exits non-zero and output contains error patterns (stack traces, "command not found", "permission denied"), a subtle indicator appears on the command block. Click to expand an AI-generated explanation with suggested fix.

**Technical:** Rust output scanner (in PTY reader thread) detects error patterns via regex. On match, extracts error text and sends to AI module for explanation. Result cached by error hash. Frontend shows a small error indicator on the block, expandable to show explanation. Explanation is lazy -- only generated when user clicks.

**Dependencies:** Shell integration (1), AI provider (3)
**Files:** `src-tauri/src/error_detector.rs` (new), `src/components/ErrorExplanation.tsx` (new)

#### 7. Natural Language to Command (`#` Mode)
- **Impact:** 9/10 -- The Warp-killer feature
- **Feasibility:** Medium -- Requires reliable prompt detection
- **Effort:** L

**User-visible:** User types `# deploy this to staging` at prompt. Cortex replaces it with `git push origin main:staging && vercel --prod` (or equivalent). Shows the generated command for review before execution. User can edit, accept (Enter), or cancel (Escape).

**Technical:** Frontend intercepts `#` at prompt start (detected via shell integration). Subsequent keystrokes go to an AI input buffer, not the PTY. On Enter, sends the natural language query + full context (cwd, git state, recent commands, `package.json` contents) to AI module. AI returns one or more candidate commands. Frontend renders them in a selection UI above the prompt. On accept, writes the selected command to PTY.

**Dependencies:** Shell integration (1), AI provider (3), Configuration (4)
**Files:** `src/components/NLCommandInput.tsx` (new), `src/hooks/useNLCommand.ts` (new), `src-tauri/src/ai/nl_to_command.rs` (new), `src-tauri/src/commands/ai_commands.rs` (new)

#### 8. Context-Aware Environment Awareness
- **Impact:** 7/10 -- Makes AI suggestions dramatically better
- **Feasibility:** High -- File system and process queries
- **Effort:** M

**User-visible:** AI knows what project type the user is in (Node, Rust, Python), what services are running (Docker containers, dev servers on ports), git state (branch, dirty files, ahead/behind), and recent command history. This context is silently gathered and fed to all AI features.

**Technical:** Rust module that periodically collects: `package.json`/`Cargo.toml`/`pyproject.toml` presence, `docker ps` output, `lsof -iTCP -sTCP:LISTEN` for open ports, `git status --porcelain`, last 50 commands from shell integration. Stored as a structured `EnvironmentContext` and passed to all AI prompts.

**Dependencies:** Shell integration (1)
**Files:** `src-tauri/src/context/mod.rs`, `src-tauri/src/context/project.rs`, `src-tauri/src/context/services.rs`, `src-tauri/src/context/git.rs` (all new)

### Tier 3: Power Features

#### 9. Structured Output Rendering
- **Impact:** 6/10 -- Nice-to-have, not essential
- **Feasibility:** Medium -- Requires output content analysis
- **Effort:** L

**User-visible:** JSON output renders as a collapsible tree. CSV renders as an aligned table. URLs become clickable with preview on hover. File paths become clickable (opens in default editor).

**Technical:** Post-processing step after command block completes. Rust analyzer attempts to parse output as JSON, CSV, or detect URL/path patterns. If structured content is detected, frontend renders a rich overlay on top of the raw xterm text within the block.

**Dependencies:** Shell integration (1)
**Files:** `src-tauri/src/output_analyzer.rs` (new), `src/components/StructuredOutput.tsx` (new), `src/components/JsonTree.tsx` (new)

#### 10. Cross-Session Memory
- **Impact:** 7/10 -- The gap nobody fills
- **Feasibility:** Medium -- Local SQLite + embedding model
- **Effort:** XL

**User-visible:** Cortex remembers commands, errors, and solutions across sessions. "Last time you hit this error, you fixed it with X." Suggests commands based on patterns from past sessions in similar project contexts.

**Technical:** SQLite database storing command blocks with metadata (cwd, project type, exit code, timestamp). Local embedding model generates vectors for semantic search. On error or at prompt, queries memory for relevant past interactions. Results fed as context to AI features.

**Dependencies:** Shell integration (1), AI provider (3), Configuration (4)
**Files:** `src-tauri/src/memory/mod.rs`, `src-tauri/src/memory/store.rs`, `src-tauri/src/memory/embeddings.rs` (all new), add `rusqlite` to Cargo.toml

---

## 4. TERMINAL-FEEL PRESERVATION RULES

These are non-negotiable constraints. Violating any of them means the product fails as a terminal, regardless of how good the AI features are.

### Latency Rules

1. **Keystroke-to-display must be under 10ms.** No AI feature, decoration, overlay, or analysis may add latency to the input-to-render path. AI runs asynchronously and decorates after the fact.

2. **PTY read-to-display must be under 5ms.** The reader thread emits bytes, the frontend renders them. No intermediate processing may block this path. Output analysis happens on a copy of the data, after rendering.

3. **No AI spinner in the terminal viewport.** If AI is processing, show a subtle indicator in the status bar or block margin. Never overlay the active terminal area with loading states.

### Behavior Rules

4. **Every keybinding must be a superset of the user's shell keybindings.** Ctrl+C is kill signal, not "copy." Ctrl+A is beginning of line, not "select all." Cmd+key is the safe namespace for Cortex features on macOS.

5. **The terminal must work with zero configuration and zero network.** First launch works. No internet required. No account required. No model download required. AI features silently degrade to disabled.

6. **Never intercept or modify PTY output before rendering.** The raw bytes from the shell appear exactly as the shell sent them. Decorations and overlays are additive layers that the user can toggle off.

7. **Never inject text into the PTY without explicit user action.** AI suggestions are ghost text or overlays. They only become real PTY input when the user presses Tab/Enter to accept. No auto-injection.

8. **Ctrl+C must always work within 50ms.** If any AI feature or overlay is active, Ctrl+C cancels it AND sends SIGINT to the foreground process. The interrupt path must be unconditional.

### UX Rules

9. **AI features must be invisible until invoked.** No persistent AI panel. No always-visible suggestion box. The terminal looks like a normal terminal until the user triggers an AI interaction.

10. **Every AI interaction must have an obvious escape hatch.** Escape key dismisses any AI overlay. The user is never trapped in an AI mode.

11. **Scrollback must work identically to any terminal.** Scroll up with mouse/trackpad, PgUp/PgDn, or Shift+PgUp. AI decorations on historical blocks must not break scroll position or selection.

12. **Copy/paste must be native.** Cmd+C copies selected text. Cmd+V pastes. No "smart paste" unless explicitly enabled. The clipboard is sacred.

---

## 5. ARCHITECTURE GAPS

### Critical Gaps (Block AI Features)

| Gap | What's Missing | Blocks |
|-----|---------------|--------|
| **No shell integration protocol** | The PTY reader is a dumb byte pipe. No awareness of prompt boundaries, command start/end, or exit codes. | Command blocks, AI suggestions, error detection, NL-to-command, context awareness |
| **No AI module in Rust** | No `src-tauri/src/ai/` directory. No provider trait, no model management, no prompt construction. | All AI features |
| **No configuration system** | Settings are hardcoded across multiple files. No user-editable config. No live reload. | AI provider setup, user customization, keybinding overrides, theme changes |
| **No async AI task infrastructure** | Tauri commands use `std::sync::Mutex`. AI calls need proper async with cancellation. The current `reqwest::blocking` in `status_commands.rs` blocks an OS thread. | AI calls that take >100ms |

### Moderate Gaps (Block Polish Features)

| Gap | What's Missing | Blocks |
|-----|---------------|--------|
| **Split panes not wired up** | `PaneLayout` and `TerminalPane` exist but `App.tsx` does not use them. No keyboard shortcuts to split/navigate. Two divergent theme definitions. | Multi-pane workflows |
| **No tab system** | Single window, single session. No way to have multiple projects open. | Multi-project workflows |
| **Theme duplication** | `constants.ts` defines one theme, `TerminalPane.tsx` defines a different one inline. No single source of truth. | Consistent appearance, theme system |
| **Hardcoded shell** | `CommandBuilder::new("/bin/zsh")` -- no support for bash, fish, nushell, or Windows shells. | Cross-platform, user preference |
| **Hardcoded project directory** | `list_projects` reads from `~/Desktop/Orellius/Projects/` only. | Public release, other users |
| **No IPC socket** | No way for external tools (editors, scripts) to communicate with Cortex. | Editor integration, remote control, plugin ecosystem |
| **No event bus** | Frontend uses Tauri events directly. No abstraction for internal event routing. | Plugin system, feature composition |

### Minor Gaps

| Gap | What's Missing |
|-----|---------------|
| CSP is `null` in `tauri.conf.json` -- should be restrictive |
| No error boundary in React -- a component crash kills the entire app |
| `reqwest` with `blocking` feature pulls in heavy sync runtime -- switch to async-only |
| No `xterm-addon-webgl` -- Canvas renderer is slower than WebGL |
| No clipboard addon for xterm |

---

## 6. RECOMMENDED BUILD ORDER (Next 10 Features)

```
1. Configuration System
   Deps: none
   Effort: S (1 session)
   Why first: Every subsequent feature needs user-configurable settings.
   Deliverable: ~/.config/cortex/config.toml with live reload, shell selection,
   font/theme overrides, AI provider endpoints.

2. Wire Up Split Panes + Tabs
   Deps: Configuration (for keybinding config)
   Effort: M (1-2 sessions)
   Why: PaneLayout and TerminalPane already exist but are disconnected.
   Connect them to App.tsx. Add Cmd+D (split), Cmd+W (close), Cmd+[ / Cmd+]
   (navigate). Unify the two divergent theme definitions. Add basic tab bar.

3. Shell Integration Protocol (OSC 133)
   Deps: none (can parallel with 1-2)
   Effort: M (1-2 sessions)
   Why: Foundation for everything AI. Without command boundaries, AI is blind.
   Deliverable: Rust PTY reader emits block events, frontend renders block
   boundaries, shell integration scripts for zsh/bash/fish.

4. Dangerous Command Guardrails
   Deps: Shell integration (3) preferred, but functional without it
   Effort: S (1 session)
   Why: Immediate user value, zero AI infra needed. Good first "intelligent"
   feature to validate the interception architecture.

5. AI Provider Adapter (Ollama + Anthropic)
   Deps: Configuration (1)
   Effort: M (1-2 sessions)
   Why: Unlocks all AI features. Async Rust module with Provider trait.
   Ship with Ollama support (local) and Anthropic (cloud, opt-in).
   Auto-detect running Ollama instance.

6. AI Inline Suggestions (Ghost Text Completion)
   Deps: Shell integration (3), AI provider (5)
   Effort: L (2 sessions)
   Why: The headline feature. Ghost text completions at the prompt from
   local model. Tab to accept. Must be under 100ms for perceived instant.

7. Error Detection + Explanation
   Deps: Shell integration (3), AI provider (5)
   Effort: M (1-2 sessions)
   Why: High daily-use value. Detects non-zero exits and error patterns,
   offers click-to-explain on command blocks.

8. Natural Language to Command (# Mode)
   Deps: Shell integration (3), AI provider (5)
   Effort: L (2 sessions)
   Why: The Warp-competitive feature. # prefix at prompt enters NL mode.
   Shows generated command for review before execution.

9. Environment Context Collector
   Deps: Shell integration (3)
   Effort: M (1-2 sessions)
   Why: Makes features 6-8 dramatically better. Collects project type,
   running services, git state, recent history. Fed silently to all AI prompts.

10. Structured Output Rendering
    Deps: Shell integration (3)
    Effort: L (2 sessions)
    Why: JSON trees, clickable URLs, file path links. Visual differentiation
    from every other terminal. Good for demos and screenshots.
```

### Dependency Graph

```
[1] Config ──────────────────┬──> [5] AI Provider ──┬──> [6] Ghost Completion
                             │                      ├──> [7] Error Detection
[2] Split Panes + Tabs       │                      └──> [8] NL-to-Command
                             │
[3] Shell Integration ───────┼──> [4] Guardrails
                             ├──> [6] Ghost Completion
                             ├──> [7] Error Detection
                             ├──> [8] NL-to-Command
                             ├──> [9] Context Collector ──> (improves 6,7,8)
                             └──> [10] Structured Output
```

Features 1, 2, and 3 can be built in parallel. Feature 4 can start as soon as 3 is done. Features 5-10 are sequential but some can overlap.

---

## 7. OPEN SOURCE READINESS CHECKLIST

### Must-Have Before Public

- [ ] **README.md** -- Project description, screenshot/GIF, install instructions, build from source, architecture overview
- [ ] **LICENSE** -- MIT (matches Cargo.toml declaration). Add LICENSE file to repo root.
- [ ] **CONTRIBUTING.md** -- How to build, run, test, submit changes. Code style expectations.
- [ ] **Remove hardcoded paths** -- `~/Desktop/Orellius/Projects/` in `list_projects` must become configurable or use XDG-standard project discovery
- [ ] **Remove Anthropic-specific code from default build** -- Claude usage meter and Keychain token reader are personal tools. Move behind a feature flag or config option.
- [ ] **Add `.gitignore` entries** -- Verify `target/`, `dist/`, `node_modules/`, `.env` are covered
- [ ] **CSP policy** -- Set a real Content-Security-Policy in `tauri.conf.json` instead of `null`
- [ ] **Cross-platform shell detection** -- Replace hardcoded `/bin/zsh` with `$SHELL` or platform-appropriate default
- [ ] **Error boundaries** -- Add React error boundary wrapping the app so a component crash shows a recovery UI, not a white screen
- [ ] **CI pipeline** -- GitHub Actions: `cargo check`, `cargo clippy`, `cargo test`, `tsc --noEmit`, `pnpm build` on push
- [ ] **Cargo.toml metadata** -- Add `repository`, `homepage`, `documentation`, `categories`, `keywords` fields
- [ ] **package.json metadata** -- Add `description`, `author`, `repository`, `license` fields
- [ ] **Icons** -- Verify `src-tauri/icons/` contains all required sizes (currently referenced but not verified to exist)
- [ ] **Minimal test suite** -- At least: PTY spawn/kill lifecycle, config parsing, command block detection
- [ ] **CHANGELOG.md** -- Start with v0.1.0 initial release
- [ ] **Code of Conduct** -- Standard Contributor Covenant
- [ ] **Security Policy** -- SECURITY.md with responsible disclosure process

### Nice-to-Have Before Public

- [ ] Website or landing page at a public URL
- [ ] Homebrew formula or `.dmg` download for macOS
- [ ] Architecture docs explaining the Tauri + PTY + xterm.js bridge
- [ ] GIF/video demo showing differentiating features
- [ ] Config migration tool for iTerm2/Alacritty/Kitty users

### Skip for Now

- Windows/Linux support (macOS-first is fine for initial release -- Ghostty did the same)
- Plugin system (too early -- get core features right first)
- Telemetry/analytics (never add without explicit opt-in)
- Auto-update (add after the manual install base validates the product)

---

## Summary

Cortex is a clean, minimal terminal foundation. The Rust PTY layer is well-architected -- proper thread isolation, no mutex contention, correct cleanup. The React frontend is functional but has dead code (unused `PaneLayout`) and configuration drift (two theme definitions).

The critical path to differentiation is: **Configuration (1 session) -> Shell Integration (2 sessions) -> AI Provider (2 sessions) -> Ghost Completion (2 sessions)**. That is roughly 7 sessions to reach a demoable AI-first terminal.

The biggest architectural risk is xterm.js performance. It is adequate for a v1 but may become the ceiling for rendering speed. Monitor keystroke-to-pixel latency. If it exceeds 10ms under load, the long-term migration to a custom wgpu renderer becomes necessary.

Build the shell integration protocol first. Everything else is decoration on a dumb byte pipe.
