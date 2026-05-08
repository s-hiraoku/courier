# Risks

Use this file to track known risks during long-running work.

## Open Risks

### 2026-05-08: Source Checkout May Not Have `courier` On PATH

- Risk: Contributors may run `courier inbox` from a checkout before the package is installed or linked.
- Impact: The shell reports `courier: command not found` even though the local CLI works through the development script.
- Likelihood: Medium.
- Mitigation: README, AGENTS, and the user guide now document `npm run dev -- inbox` for source checkouts and `npm link` for local command exposure.
- Status: Mitigated.

### 2026-05-07: Manual Receiver Checks Can Be Missed

- Risk: Receivers may forget to run `courier inbox`.
- Impact: Handoffs remain unread and sender status stays `new`.
- Likelihood: Medium.
- Mitigation: README, AGENTS, and the user guide explicitly document that receivers must check `courier inbox`; future detection remains an open design area.
- Status: Open.

### 2026-05-07: Simple Frontmatter Parser Is Intentionally Limited

- Risk: Hand-edited Markdown that uses complex YAML may not parse.
- Impact: Handoff list/status commands may skip or reject malformed files.
- Likelihood: Low for Courier-generated files.
- Mitigation: Keep generated frontmatter simple and test lifecycle updates; avoid promising general YAML support.
- Status: Open.

## Closed Risks

No closed risks recorded yet.
