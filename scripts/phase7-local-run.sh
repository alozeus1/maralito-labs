#!/usr/bin/env bash
# =============================================================================
# Phase 7 — Local Operator Gate Runner (BorderPass / Maralito Labs)
# ADR-0013 · DEVELOPMENT-ONLY. Runs the Phase 7 gates from YOUR machine.
#
# Safety contract:
#   - Never prints secrets. Redacts any postgres:// URL from all output/logs.
#   - Stops on the first failure (set -euo pipefail).
#   - Does NOT touch the database unless you pass --apply-db (or PHASE7_APPLY_DB=1).
#   - Reads secrets from ./.env.local (gitignored). Never commit that file.
#   - Writes a timestamped, redacted evidence log you can paste into the ledger.
#
# Usage:
#   bash scripts/phase7-local-run.sh              # local gates only (no DB touched)
#   bash scripts/phase7-local-run.sh --apply-db   # local gates + migrate/RLS/seed/gate:rls
#
# Prereqs on your machine:
#   - Node 22 (repo engine: >=22 <23), pnpm (via corepack), git, psql.
#   - ./.env.local with DATABASE_URL set to the DIRECT/SESSION (5432) connection.
#     Percent-encode special chars in the password (e.g. '@' -> '%40').
# =============================================================================
set -euo pipefail
set +x  # never trace (would leak secrets)

# ---- config ---------------------------------------------------------------
APPLY_DB=0
[[ "${1:-}" == "--apply-db" || "${PHASE7_APPLY_DB:-0}" == "1" ]] && APPLY_DB=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="docs/phase-7/run-logs"
LOG="$LOG_DIR/phase7-local-$TS.log"
mkdir -p "$LOG_DIR"

RLS_DIR="packages/db/src/rls"
RLS_FILES=(
  "policies.sql"                       # 1. foundation (roles/helpers/base grants) — MUST be first
  "orders-policies.sql"                # 2
  "quotes-policies.sql"                # 3
  "payments-policies.sql"              # 4
  "notifications-policies.sql"         # 5
  "inspections-policies.sql"           # 6
  "delivery-preparations-policies.sql" # 7
)

# ---- helpers --------------------------------------------------------------
# Redact any connection string from a stream before it reaches the terminal/log.
redact() { sed -E 's#postgres(ql)?://[^[:space:]"'"'"']*#postgres://***REDACTED***#g'; }

log()  { echo "$*" | redact | tee -a "$LOG" >&2; }
hr()   { log "-----------------------------------------------------------------"; }

declare -a RESULTS=()

# run "<gate-name>" <command...> : run a gate, capture exit+timestamp, redact, record.
run() {
  local name="$1"; shift
  local start; start="$(date -u +%H:%M:%SZ)"
  hr; log "▶ GATE: $name"; log "  cmd: $*"; log "  started: ${TS%T*} ${start}"
  set +e
  ( "$@" ) 2>&1 | redact | tee -a "$LOG"
  local rc=${PIPESTATUS[0]}
  set -e
  if [[ $rc -eq 0 ]]; then
    log "  ✅ PASS ($name) exit=0 at $(date -u +%H:%M:%SZ)"
    RESULTS+=("PASS  | $name | exit 0 | $(date -u +%Y-%m-%dT%H:%M:%SZ)")
  else
    log "  ⛔ FAIL ($name) exit=$rc at $(date -u +%H:%M:%SZ)"
    RESULTS+=("FAIL  | $name | exit $rc | $(date -u +%Y-%m-%dT%H:%M:%SZ)")
    summary; log ""; log "STOP: '$name' failed (exit $rc). Nothing after this ran. See $LOG"
    exit "$rc"
  fi
}

skip() { RESULTS+=("SKIP  | $1 | $2 | $(date -u +%Y-%m-%dT%H:%M:%SZ)"); log "  ⏭ SKIP ($1): $2"; }

summary() {
  hr; log "SUMMARY (Phase 7 local run $TS)"
  for r in "${RESULTS[@]}"; do log "  $r"; done
  hr
}

# ---- 0. environment sanity ------------------------------------------------
hr; log "Phase 7 local operator run — $TS — DEVELOPMENT-ONLY"; hr

# git worktree?
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { log "⛔ Not a git repo. Run from your cloned monorepo."; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"; HEAD_SHA="$(git rev-parse --short HEAD)"
log "  repo: $REPO_ROOT"; log "  branch: $BRANCH @ $HEAD_SHA"
log "  git status (short):"; git status --short | redact | tee -a "$LOG" || true

# node 22?
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[[ "$NODE_MAJOR" == "22" ]] || { log "⛔ Node 22 required (found: $(node -v 2>/dev/null || echo none)). Use nvm/asdf to switch."; exit 1; }
log "  node: $(node -v)"

# pnpm (enable via corepack if missing)
if ! command -v pnpm >/dev/null 2>&1; then
  log "  pnpm not found — enabling via corepack"; corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || { log "⛔ pnpm unavailable. Install: 'corepack enable && corepack prepare pnpm@latest --activate'"; exit 1; }
log "  pnpm: $(pnpm -v)"

# load .env.local WITHOUT printing values (only needed for --apply-db)
if [[ -f .env.local ]]; then
  set -a; # shellcheck disable=SC1091
  source ./.env.local; set +a
  log "  .env.local: loaded (values not shown)"
else
  log "  .env.local: ABSENT"
fi

# ---- LOCAL GATES (no DB, no secrets) --------------------------------------
run "preflight (local guards)"      pnpm preflight
run "install (frozen lockfile)"     pnpm install --frozen-lockfile
run "typecheck (workspace)"         pnpm typecheck
run "unit tests (vitest)"           pnpm test
run "build (next app)"              pnpm build

# baseline migration must exist before any DB apply
MIG_COUNT="$(find packages/db/migrations -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$MIG_COUNT" == "0" ]]; then
  log ""; log "⚠ No committed migration found in packages/db/migrations/."
  log "  Generating a baseline from the schema for you to REVIEW (offline, no DB):"
  run "generate baseline migration" pnpm --filter @maralito/db db:generate
  log ""; log "  ➜ Review the generated SQL under packages/db/migrations/, commit it, then re-run with --apply-db."
  log "    (Not applying to the database in this run because the migration was just generated and is unreviewed.)"
  summary
  log ""; log "Local gates complete. Baseline migration generated — REVIEW + COMMIT, then: bash scripts/phase7-local-run.sh --apply-db"
  exit 0
fi
log "  committed migrations present: $MIG_COUNT file(s)"

# ---- DB GATES (only with --apply-db) --------------------------------------
if [[ "$APPLY_DB" -ne 1 ]]; then
  skip "migrate/RLS/seed/gate:rls" "re-run with --apply-db to execute against DATABASE_URL"
  summary
  log ""; log "Local gates PASSED. DB gates skipped (safe default). To run them:"
  log "  1) Ensure .env.local has DATABASE_URL = DIRECT/SESSION (5432) connection, password %-encoded."
  log "  2) bash scripts/phase7-local-run.sh --apply-db"
  exit 0
fi

# preconditions for DB apply
[[ -n "${DATABASE_URL:-}" ]] || { log "⛔ DATABASE_URL not set (put it in .env.local; use the 5432 direct/session URL)."; exit 1; }
command -v psql >/dev/null 2>&1 || { log "⛔ psql not found (needed to apply RLS files). Install postgresql-client."; exit 1; }
case "${DATABASE_URL}" in
  *:6543/*) log "⚠ DATABASE_URL uses the transaction pooler (6543). Migrations + gate:rls want the DIRECT/SESSION (5432) URL. Continuing, but switch if role assumption or DDL fails." ;;
esac
log ""; log "DB apply mode ON. Target = the DATABASE_URL in .env.local (value hidden)."

# migrate
run "db:migrate (live)" pnpm --filter @maralito/db db:migrate

# apply 7 RLS files in order, fail-fast per file
for f in "${RLS_FILES[@]}"; do
  path="$RLS_DIR/$f"
  [[ -f "$path" ]] || { log "⛔ Missing RLS file: $path"; exit 1; }
  run "RLS apply: $f" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$path"
done

# seed (synthetic org + roles only; no PII)
run "db:seed (synthetic)" pnpm --filter @maralito/db db:seed

# live RLS isolation gate (non-destructive; self-seeds + rolls back)
run "gate:rls (live isolation)" pnpm gate:rls

# ---- done -----------------------------------------------------------------
summary
log ""
log "ALL RUN GATES PASSED (see per-gate exits above). BorderPass remains DEVELOPMENT-ONLY."
log "Evidence log: $LOG"
log ""
log "Ledger rows now supported by THIS run (tick in docs/phase-7/gate-ledger.md ONLY from this log):"
log "  1 install · 2 typecheck · 3 build · 4 vitest · 7 migrate · 8 RLS(all 7) · 9 seed · 10 gate:rls"
log "Still UNRUN (not covered here): 5 PR CI · 6 provisioning(attested) · 11 OTP smoke (blocked: auth redirect incident)"
log "  12-15 Stripe · 16 KMS · 17 preview-branching · 18 env/secrets review · 19 sign-off"
log ""
log "Paste the SUMMARY block above into the gate-ledger evidence column with branch $BRANCH @ $HEAD_SHA and project ref rupqejwzmwfspvbmkmai."
