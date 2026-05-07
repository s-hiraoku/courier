# Verification Log

Use this file to record meaningful verification runs.

## Template

### YYYY-MM-DD HH:MM

- Command:
- Scope:
- Result:
- Notes:

## Runs

### 2026-05-07 JST

- Command: `npm ci`
- Scope: dependency installation from lockfile
- Result: passed
- Notes: 0 vulnerabilities after updating Vitest.

### 2026-05-07 JST

- Command: `npm run build`
- Scope: TypeScript compile and CLI executable bit
- Result: passed
- Notes: `dist/cli.js` was generated and executable.

### 2026-05-07 JST

- Command: `npm test`
- Scope: filesystem integration tests
- Result: passed
- Notes: 10 tests passed for config, targets, send, attachments, inbox, lifecycle, and status.

### 2026-05-07 JST

- Command: `npm audit`
- Scope: dependency vulnerability audit
- Result: passed
- Notes: 0 vulnerabilities.

### 2026-05-07 JST

- Command: `env npm_config_cache=/tmp/courier-npm-cache npm pack --dry-run`
- Scope: package contents
- Result: passed
- Notes: Verified `dist`, README, AGENTS, and docs are included.

### 2026-05-07 JST

- Command: `dist/cli.js` full sender/receiver workflow smoke test
- Scope: built CLI entrypoint and complete handoff loop
- Result: passed
- Notes: Sent, listed, read, acknowledged, completed, and checked sender status in temporary workspaces.

### 2026-05-07 JST

- Command: `npm run verify`
- Scope: project-local Codex harness
- Result: passed
- Notes: Ran `npm run build`, `npm test`, and `npm audit` through `scripts/verify.sh`.
