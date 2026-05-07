# Context Courier

Context Courier is a small cross-workspace handoff tool.

It allows one workspace to send structured context into another workspace's inbox.

It supports a minimal handoff lifecycle: new, acknowledged, and done.

It intentionally does not automate terminal control or agent execution.

Context Courier is a local-first CLI for leaving actionable context in another local workspace. It writes human-readable files under `.courier/`, so the inbox files are the API.

Rig is only an example target workspace. Context Courier is project-agnostic.

## Why It Exists

Work often starts in one repository and turns into useful context for another repository: bug notes, logs, implementation clues, design follow-ups, or tasks. Copying that into chat loses lifecycle state. Context Courier keeps the handoff visible as a file and lets the sender later check whether it was acknowledged or completed.

## How It Differs From Synapse And Rig

Synapse is background context for experimental agent communication. Context Courier does not implement Synapse-specific behavior.

Rig is background context for local execution harnesses. Context Courier does not implement Rig-specific behavior.

Courier only sends, receives, reads, acknowledges, completes, and checks local handoff files across workspaces.

## Install And Build

```bash
npm install
npm run build
```

During development:

```bash
npm run dev -- init
```

After build, the package exposes:

```bash
courier
```

## Verification Harness

This repository includes a small project-local harness adapted from [s-hiraoku/codex-harnesses](https://github.com/s-hiraoku/codex-harnesses).

Run the same verification entrypoint locally and in CI:

```bash
npm run verify
```

The harness is intentionally small:

- `scripts/verify.sh` runs build, tests, and `npm audit`.
- `scripts/checkpoint.sh` appends a resumable checkpoint to `ledger/current.md`.
- `ledger/` records task state, durable decisions, risks, and verification runs.

It does not add hooks, terminal automation, agent orchestration, MCP behavior, or a background process.

## Workspace Layout

Each workspace can contain:

```txt
.courier/
  config.json
  inbox/
  sent/
  attachments/
```

Courier writes only under `.courier/`, except that `courier send --file <path>` reads the source file so it can copy it into the target workspace's `.courier/attachments/` directory.

## Handoff Lifecycle

Every handoff starts as `new`.

The receiver can run:

```bash
courier ack <handoff-id>
```

That changes the status to `acknowledged`.

The receiver can run:

```bash
courier done <handoff-id>
```

That changes the status to `done`.

Status updates modify both the YAML frontmatter and the visible `## Status` section in the Markdown handoff file.

## Receiver Checks

Courier does not notify receivers automatically in the MVP. The receiver checks handoffs explicitly:

```bash
courier inbox
```

The sender is responsible for telling the receiver to check `courier inbox`, or the receiver can make `courier inbox` part of its startup routine.

Future receiver detection is intentionally left open. Possible future directions include polling, filesystem watching, startup hooks, or editor/agent integration, but none are implemented in this MVP.

## Commands

```bash
courier init
courier target add <name> <path>
courier targets
courier send --to <target> [--title <title>] ["<message>"] [--file <path>]
courier inbox
courier inbox --all
courier read <handoff-id>
courier ack <handoff-id> [--note <note>]
courier done <handoff-id> [--note <note>]
courier sent
courier status <handoff-id>
```

## Full Workflow

Create two local workspaces:

```bash
mkdir -p /tmp/app-project /tmp/library-project
```

Initialize the sender:

```bash
cd /tmp/app-project
courier init
courier target add library-project /tmp/library-project
```

Send a handoff:

```bash
courier send --to library-project \
  --title "Auth helper fails when token is empty" \
  "The auth helper returns success when the token is an empty string."
```

In the receiving workspace:

```bash
cd /tmp/library-project
courier inbox
courier read <handoff-id>
courier ack <handoff-id> --note "Confirmed. I will inspect this."
courier done <handoff-id> --note "Fixed validation for empty token."
```

Back in the sender:

```bash
cd /tmp/app-project
courier sent
courier status <handoff-id>
```

## Attachments

Attach a file:

```bash
courier send --to library-project --title "Failure log" --file ./logs/error.log
```

Small text files under 100 KB are embedded in the Markdown handoff and copied into the target attachments directory. Large files and binary-looking files are copied but not embedded.

## Safety Philosophy

Context Courier is manual-first and file-based. It does not run commands in target workspaces, send keystrokes, control PTYs, start agents, contact network services, run a daemon, create queues, or use a database.

## Non-Goals

Context Courier is not an agent runner, PTY automation framework, terminal controller, agent orchestrator, MCP server, network service, daemon, task queue, workflow engine, or database-backed platform.
