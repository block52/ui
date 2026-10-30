# Agent Instructions

Every agent working in this repo (Claude Code, Codex, Copilot, Cursor or any
other) must follow [CLAUDE.md](CLAUDE.md). Read it before writing code.

The rules agents break most often:

- **Use the guards** (UI Architecture Commandment 8). Null, empty and length
  checks go through `src/utils/guards.ts` (`hasValue`, `isNullish`,
  `hasElements`, `isEmpty`, `safeLength`, `hasContent`, `isBlank`), never
  `x && x.length > 0` or `x !== null && x !== undefined` by hand.
- **No helper functions in components.** Logic goes in `src/utils/` with a
  colocated `*.test.ts`.
- **SDK types only** (Types Commandment 1) and **no defaults** (Types
  Commandment 7).
- **New features need unit tests**, and every PR with a visible change needs
  screenshots.
