#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE="${CODEX_HARNESSES_STRICT:-0}"

missing_check() {
  local message="$1"
  echo "${message}"
  if [[ "${STRICT_MODE}" == "1" ]]; then
    return 1
  fi
}

run_npm_script() {
  local script_name="$1"

  if ! command -v npm >/dev/null 2>&1; then
    missing_check "npm not found; cannot run ${script_name}"
    return
  fi

  if npm run | grep -E "^[[:space:]]+${script_name}$|^[[:space:]]+${script_name}:" >/dev/null 2>&1; then
    echo "Running npm run ${script_name}"
    npm run "${script_name}"
  else
    missing_check "No npm script '${script_name}' detected"
  fi
}

main() {
  if [[ ! -f package.json ]]; then
    missing_check "package.json not found; no Context Courier verification available"
    return
  fi

  run_npm_script build
  run_npm_script test

  if command -v npm >/dev/null 2>&1; then
    echo "Running npm audit"
    npm audit
  fi

  echo "Context Courier verification completed"
}

main "$@"
