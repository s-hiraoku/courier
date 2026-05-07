# Current Task Ledger

Use this file to keep long-running Context Courier work resumable.

## Current Goal

- Goal: Deliver the Context Courier MVP with tests, CI, GitHub Pages guide, and a Codex harness.
- Owner: Codex
- Started: 2026-05-07 JST
- Status: Draft PR opened and harness adoption in progress

## Context

- Repository: context-courier
- Branch: codex/context-courier-mvp
- Pull request: https://github.com/s-hiraoku/courier/pull/1
- Important files: src/, tests/courier.test.ts, README.md, AGENTS.md, docs/index.html, scripts/verify.sh, .github/workflows/ci.yml

## Plan

- [x] Implement complete local handoff lifecycle
- [x] Add filesystem tests
- [x] Add CI and GitHub Pages guide
- [x] Open draft PR
- [x] Adapt codex-harnesses verification and ledger patterns
- [ ] Keep PR checks passing after harness update

## Progress

- 2026-05-07 JST: Implemented the standalone TypeScript CLI with `init`, `target add`, `targets`, `send`, `inbox`, `read`, `ack`, `done`, `sent`, and `status`.
- 2026-05-07 JST: Added temporary-directory tests for config, targets, send, attachments, inbox, prefix matching, lifecycle, and sender/receiver status.
- 2026-05-07 JST: Added README, AGENTS instructions, GitHub Pages user guide, CI, and draft PR #1.
- 2026-05-07 JST: Added a project-local Codex harness adapted from s-hiraoku/codex-harnesses.

## Blockers

- None recorded.

## Next Step

- Run `scripts/verify.sh`, update the PR branch, and confirm CI remains green.

## Checkpoints

`scripts/checkpoint.sh` appends entries here.
