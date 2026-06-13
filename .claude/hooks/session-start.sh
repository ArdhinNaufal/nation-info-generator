#!/bin/bash
# SessionStart hook for nation-info-generator.
# - Surfaces the AI-SDLC workflow context at the top of every session (stdout becomes context).
# - Installs dependencies once a stack is chosen (idempotent; safe to run repeatedly).
# Synchronous by design: guarantees setup is done before the agent loop starts (no race).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# --- Dependency install (idempotent; grows with the project) -------------------------------
# Prefer cache-friendly installs (e.g. `npm install` over `npm ci`) since container state is
# cached after the hook completes. Uncomment / add as the stack is decided.
if [ -f package.json ]; then
  command -v npm >/dev/null 2>&1 && npm install --no-audit --no-fund >/dev/null 2>&1 || true
elif [ -f requirements.txt ]; then
  command -v pip >/dev/null 2>&1 && pip install -q -r requirements.txt || true
elif [ -f pyproject.toml ]; then
  command -v uv >/dev/null 2>&1 && uv sync >/dev/null 2>&1 || true
fi

# --- Workflow context (high-signal reminder; keep it short) --------------------------------
cat <<'CTX'
[nation-info-generator] AI-SDLC workflow active.
Loop: SPECIFY -> PLAN -> EXECUTE -> VERIFY -> RECORD (learnings feed back).
- Spec a feature before building (skill: spec-interview); build in a fresh session.
- Gate "done" on evidence, not assertions (skill: verify -> scripts/check.sh).
- Independent review at milestones via the code-reviewer agent (fresh context).
- Record gotchas in learnings/; keep task state in todos/.
Context layer: CLAUDE.md, MEMORY.md, CRITICAL-RULES.md, SPEC.md/specs/.
CTX
