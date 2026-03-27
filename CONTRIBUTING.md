# Contributing to Cortex Terminal

Cortex is built by [Orellius Labs](https://orellius.ai). We welcome contributions from the community.

## How to contribute

### Report bugs

Open an [issue](https://github.com/Orellius/cortex-terminal/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Your OS version and Cortex version

### Suggest features

Open an issue with the `feature` label. Describe the use case, not just the solution.

### Submit code

1. Fork the repo
2. Create a branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run `cargo check` and `npx tsc --noEmit` (both must pass)
5. Commit with a clear message (`feat: add X`, `fix: resolve Y`)
6. Push and open a PR

### Code standards

- Rust: no `.unwrap()` or `.expect()`. Use `anyhow` for errors. Run `cargo fmt`.
- TypeScript: strict mode. No `any`. Named exports only. No default exports.
- Files: 300 lines max. Split by feature if longer.
- No hardcoded paths, secrets, or API keys.

### Architecture

- Frontend (React): presentational only. No direct API calls to AI providers.
- Backend (Rust): owns all provider state, cost tracking, verification. All AI calls go through Tauri IPC.
- New features should follow the existing pattern: Rust command + TypeScript hook + React component.

## First time?

Good first issues are labeled [`good first issue`](https://github.com/Orellius/cortex-terminal/labels/good%20first%20issue). These are scoped, self-contained tasks that don't require deep knowledge of the codebase.

Ideas for first contributions:
- Add a new slash command
- Add a new MCP server to the examples list
- Improve markdown rendering (tables, syntax highlighting)
- Add keyboard shortcut for a missing action
- Fix a UI alignment or spacing issue

## Star the repo

If Cortex is useful to you, star the repo. It helps others discover the project and motivates continued development.

[![Star on GitHub](https://img.shields.io/github/stars/Orellius/cortex-terminal?style=social)](https://github.com/Orellius/cortex-terminal)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
