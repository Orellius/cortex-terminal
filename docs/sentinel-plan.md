# Sentinel — Context Guardian for AI Coding Tools

**Problem:** LLMs suffer from Context Window Degradation. After 10-15 minutes of coding, the AI forgets architectural rules and reverts to junior-level behavior (monolithic files, hardcoded values, ignoring SRP).

**Solution:** Hybrid system — proactive Claude Code hooks + intelligent MCP server.

## Root Causes of Degradation

| Cause | Mechanism | Solution |
|-------|-----------|----------|
| **Compaction** | Context window fills, summarizer drops behavioral rules | SessionStart hook re-injects rules on every compact |
| **Attention dilution** | Recent code/output drowns out early rules | Periodic rule re-injection every N tool calls |
| **Task momentum** | Model optimizes for "get it working" over "follow rules" | PreToolUse hook interrupts with rule check before writes |
| **Rule scattering** | Rules in 5+ files, model forgets some | MCP consolidates all rules into one queryable source |
| **No feedback loop** | Violations compound without real-time catch | PostToolUse hook catches violations immediately |

## MCP vs Hooks vs Hybrid Comparison

| Criterion | Hooks Only | MCP Only | Hybrid |
|-----------|-----------|----------|--------|
| Proactive enforcement | YES | NO (LLM must call) | YES |
| Deep semantic analysis | NO (syntactic) | YES (AST) | YES |
| Survives compaction | YES | NO | YES |
| Cross-client portable | NO (Claude Code) | YES (any MCP) | PARTIAL |
| Can block violations | YES (deny) | NO (advisory) | YES |
| Solves attention drift | YES (re-injection) | NO | YES |
| Open source potential | Low | HIGH | HIGH |

**Verdict: Hybrid wins. Build hooks first (80% of value), MCP second (deep analysis + portability).**

## Phase 1: Hooks (1-2 sessions)

### Hook 1: SessionStart (startup, resume, compact, clear)
- Reads: CLAUDE.md, project CLAUDE.md, MEMORY.md, rules/*.md
- Consolidates into prioritized rule summary (max 2000 tokens)
- Injects as additionalContext
- **This is the #1 defense against compaction degradation**

### Hook 2: PreToolUse:Write|Edit
Lightweight syntactic checks (< 100ms):
- File line count > 300 → WARNING injected
- Regex for hardcoded px (not 1px borders) → WARNING
- `.unwrap()` / `.expect()` in Rust → WARNING
- Hardcoded absolute paths → WARNING
- > 5 useState in one component → WARNING
- Injects warning as additionalContext, does NOT deny (too aggressive)

### Hook 3: PostToolUse:Write|Edit (periodic)
- Counts writes since last rule refresh
- Every 5 writes: re-injects condensed "ACTIVE RULES REMINDER"
- Logs: files modified, line counts, violations caught

### Hook Registration
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume|compact|clear",
      "hooks": [{ "type": "command", "command": "node ~/.sentinel/session-start.mjs" }]
    }],
    "PreToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{ "type": "command", "command": "node ~/.sentinel/pre-write.mjs" }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{ "type": "command", "command": "node ~/.sentinel/post-write.mjs" }]
    }]
  }
}
```

## Phase 2: MCP Server (2-3 sessions)

### Tools
| Tool | Input | Output | Purpose |
|------|-------|--------|---------|
| `validate_file` | file_path | violations, score, suggestions | Deep AST-level analysis |
| `get_rules` | context, file_type | filtered rules | Context-aware rule retrieval |
| `check_architecture` | directory | files_over_limit, deps, suggestions | Directory health check |
| `suggest_split` | file_path | proposed modules, what moves where | Intelligent refactoring |

### Resources
- `sentinel://rules` — all active rules as one readable resource
- `sentinel://violations` — session violation log
- `sentinel://report` — session compliance summary

### Tech Stack
- TypeScript, stdio transport
- @typescript-eslint/parser for TS/TSX analysis
- tree-sitter for Rust analysis
- npm package: `@orellius/sentinel`

## Phase 3: Open Source (1 session)
- Universal config (reads CLAUDE.md, .cursorrules, .windsurfrules)
- README with problem statement, install, examples
- npm publish
- Works with: Claude Code (hooks + MCP), Cursor (MCP), any MCP client

## File Structure
```
sentinel/
├── package.json
├── src/
│   ├── session-start.mjs      — rule consolidation + injection
│   ├── pre-write.mjs          — syntactic violation checks
│   ├── post-write.mjs         — periodic re-injection + logging
│   ├── rules-loader.mjs       — reads all rule sources
│   ├── validators/
│   │   ├── line-count.mjs
│   │   ├── hardcoded-values.mjs
│   │   ├── rust-safety.mjs
│   │   └── modularity.mjs
│   ├── mcp/
│   │   ├── server.mjs         — MCP server entry
│   │   ├── tools/
│   │   │   ├── validate-file.mjs
│   │   │   ├── get-rules.mjs
│   │   │   ├── check-architecture.mjs
│   │   │   └── suggest-split.mjs
│   │   └── resources/
│   │       ├── rules.mjs
│   │       └── violations.mjs
│   └── config.mjs
└── README.md
```

## Expected Impact
- Phase 1 alone: ~70% reduction in rule violations
- Phase 1+2: ~90% reduction
- Measured by: violations per session compared to baseline (today's 3-hour Cortex session)

## Why This Matters Beyond Personal Use
Every developer using AI coding tools faces context degradation. Nobody has built proactive enforcement. The market is focused on AI capabilities; nobody is building AI discipline. Sentinel fills this gap.

Aligns with Orellius mission: "One human, the scale of teams" — Sentinel makes the AI teammate reliable over long sessions.
