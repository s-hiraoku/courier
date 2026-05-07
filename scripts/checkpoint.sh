#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ledger_file="${repo_root}/ledger/current.md"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null || echo "unknown")"
status="$(git -C "${repo_root}" status --short 2>/dev/null || echo "git status unavailable")"
commit="$(git -C "${repo_root}" rev-parse --short HEAD 2>/dev/null || echo "no commit")"

mkdir -p "$(dirname "${ledger_file}")"

{
  echo
  echo "### ${timestamp}"
  echo
  echo "- Branch: ${branch:-unknown}"
  echo "- Latest commit: ${commit}"
  echo "- Short status:"
  if [[ -n "${status}" ]]; then
    printf '  - %s\n' "${status//$'\n'/$'\n  - '}"
  else
    echo "  - clean"
  fi
} >> "${ledger_file}"

echo "Checkpoint appended to ${ledger_file}"
