#!/usr/bin/env bash
# Deterministic verification check for nation-info-generator.
# Code is deterministic; language interpretation isn't — so the gate is a script, not prose.
#
# Wire the real lint + test commands below once the stack is chosen (see CLAUDE.md).
# Until then this exits non-zero on purpose: an unspecified project has no passing verifier.

set -uo pipefail
cd "$(dirname "$0")/../../../.." || exit 2

fail=0

run() {
  # run "<label>" <command...>
  local label="$1"; shift
  echo "==> ${label}: $*"
  if "$@"; then
    echo "    OK"
  else
    echo "    FAILED (exit $?)"
    fail=1
  fi
}

echo "nation-info-generator :: verification check"
echo "-------------------------------------------"

run "typecheck" npm run lint
run "test"      npm test

echo "-------------------------------------------"
if [ "$fail" -eq 0 ]; then
  echo "RESULT: PASS"
else
  echo "RESULT: FAIL"
fi
exit "$fail"
