# Decisions

Use this file for durable decisions that future Codex sessions should respect.

## Decisions

### 2026-05-07: Keep Courier Project-Agnostic

- Decision: Rig and Synapse remain background context only.
- Context: The MVP is a generic cross-workspace handoff utility.
- Alternatives considered: Add Rig-specific or Synapse-specific integrations.
- Rationale: The product boundary is local inbox/outbox handoffs, not execution or agent orchestration.
- Consequences: Future integrations require explicit design review and must not weaken the file-based API.

### 2026-05-07: Receiver Detection Is Future Work

- Decision: MVP receivers check `courier inbox` explicitly.
- Context: Automatic detection would imply polling, watchers, hooks, or integrations.
- Alternatives considered: Implement `watch`, daemon mode, or startup hooks now.
- Rationale: Manual-first behavior preserves the non-goals around daemons, notifications, terminal control, and agent automation.
- Consequences: Documentation must explain that the sender or workspace routine triggers receiver checks.

### 2026-05-07: Use A Small Project-Local Harness

- Decision: Adopt only the `codex-harnesses` verification and ledger patterns needed for this repository.
- Context: The upstream harness collection includes skills, hooks, policies, examples, and docs.
- Alternatives considered: Vendor the whole harness repository.
- Rationale: Courier should stay small; unused hooks and policies would add maintenance weight.
- Consequences: `scripts/verify.sh`, `scripts/checkpoint.sh`, and `ledger/` are maintained as Courier-specific harness files.
