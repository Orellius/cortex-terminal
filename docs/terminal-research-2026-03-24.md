# Terminal Landscape Research — 2026-03-24

## Market Overview

| Terminal | Stars | Language | Latency | RAM | Open Source |
|----------|-------|----------|---------|-----|-------------|
| Tabby | 69.7K | TS/Electron | ~10-15ms | 300-400MB | Yes |
| Alacritty | 63.1K | Rust | ~3ms | ~30MB | Yes |
| Ghostty | 48.3K | Zig | ~2ms | 60-100MB | Yes |
| Hyper | 44.7K | TS/Electron | ~10-15ms | 300-400MB | Yes |
| Kitty | 32K | C/Python | ~3ms | 60-100MB | Yes |
| Warp | 26.2K | Rust | ~2ms | 100-200MB | Partial |
| WezTerm | 25.1K | Rust | ~4ms | 300-400MB | Yes |
| Wave | 18.6K | Go+Electron | ~10-15ms | 300-400MB | Yes |
| Rio | 6.6K | Rust | ~4ms | ~50MB | Yes |

## Feature Matrix

| Feature | Hyper | iTerm2 | Warp | Alacritty | Kitty | WezTerm | Ghostty |
|---------|-------|--------|------|-----------|-------|---------|---------|
| Split panes | Plugin | Native | Yes | No | Yes | Yes | Yes |
| GPU rendering | WebGL | No | Metal | OpenGL | OpenGL | Multi | Metal/Vulkan |
| Plugin system | npm | Python | No | No | Kittens | Lua | No |
| AI integration | No | Basic | Core | No | No | No | No |
| Inline images | No | Yes | No | No | Kitty proto | All protos | Kitty proto |
| Command blocks | No | No | Yes | No | No | No | No |
| Config | JSON | GUI | GUI | TOML | Custom | Lua | Key-value |

## What Warp Does (AI Leader)
- Universal prompt: `#` for AI mode, normal typing for commands
- Blocks: every command+output grouped, AI can reference
- Context attachment: `@file`, `@url` syntax
- Parallel cloud agents (Oz platform)
- 20+ LLMs, smart routing

## What Wave Does (Privacy Leader)
- BYOK/BYOLLM: Ollama, LM Studio, llama.cpp, LocalAI
- No account required, no telemetry
- Block-based workspace: terminal + editor + browser coexist
- Full open source

## Gaps Nobody Fills
1. **Semantic command understanding** — no terminal knows "this deploys to prod"
2. **Cross-session memory** — every session starts from zero
3. **Environment awareness** — ports, Docker, git state, running services
4. **Structured output** — JSON as trees, CSV as tables, URLs as previews
5. **Plugin ecosystem for AI** — no standard protocol
6. **Collaborative terminal** — real-time shared sessions
7. **Visual debugging loop** — detect error, explain, suggest fix, apply

## Cortex Positioning

**The market gap**: No terminal is simultaneously fast (Ghostty-tier), AI-native (Warp-tier), private (Alacritty-tier), and extensible (Kitty/WezTerm-tier).

### Architecture Recommendations

**Rendering**: Rust + wgpu (WebGPU abstraction over Metal/Vulkan/DX12)
**Config**: Lua + TOML hybrid
**Plugins**: WASM sandboxed (language-agnostic, memory-safe)
**AI Providers**: MCP-like adapter protocol

### AI Tiers (All Local-First)

**Tier 1 — On-device, zero latency:**
- Smart autocomplete (local 3B model, <50ms)
- Error detection + explanation
- Semantic command blocks
- Dangerous command guardrails

**Tier 2 — On-device, moderate latency:**
- Natural language to command (7B-13B model)
- Output summarization
- Context-aware suggestions (learned patterns)

**Tier 3 — Cloud-optional (explicit consent):**
- Complex debugging
- Code generation
- Team knowledge sharing

### Process Architecture
```
Render Thread (GPU) ←→ Event Loop ←→ Shell Process (PTY)
                                  ←→ AI Engine (separate process)
```
AI never blocks rendering. Results are decorative overlays.

### Switch Triggers (Why Users Leave Current Terminal)
1. Performance parity with Ghostty/Alacritty
2. AI that works offline
3. Blocks + semantic understanding
4. Zero trust required (no account, no telemetry)
5. Smooth migration (import iTerm2/Alacritty/Kitty configs)
