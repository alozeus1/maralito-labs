#!/usr/bin/env bash
# =============================================================================
# Phase 7 — Stripe TEST-mode Gate Runner (BorderPass / Maralito Labs)
# ADR-0013 · DEVELOPMENT-ONLY. Runs the Phase 7 Stripe rows 12–15 from YOUR machine.
#
# Safety contract:
#   - TEST MODE ONLY. Refuses sk_live_. Never enables live Stripe.
#   - Never prints Stripe secret key or webhook signing secret (redacted from all output/logs).
#   - No card data is ever stored or printed (test card 4242… is entered in the UI, not here).
#   - Stops on the first failure (set -euo pipefail).
#   - Reads secrets from ./.env.local (gitignored). Never commit that file.
#   - Writes a timestamped, redacted evidence log under docs/phase-7/run-logs/.
#   - Row 15 (Stripe LIVE validation) is NEVER marked passed by this script.
#
# Usage:
#   bash scripts/phase7-stripe-gate.sh              # offline checks + operator-guided live TEST round-trip
#   bash scripts/phase7-stripe-gate.sh --dry-run    # offline checks + print the plan; no live round-trip prompts
#   bash scripts/phase7-stripe-gate.sh --evidence-only   # (re)write the evidence log skeleton only
#
# Prereqs on your machine:
#   - Node 22, pnpm (corepack), Stripe CLI (`stripe`), the app runnable (`pnpm dev`).
#   - ./.env.local with STRIPE_SECRET_KEY=sk_test_… , NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… ,
#     STRIPE_WEBHOOK_SECRET=whsec_… (from `stripe listen`). All TEST mode.
# =============================================================================
set -euo pipefail
set +x  # never trace (would leak secrets)

MODE="run"
case "${1:-}" in
  --dry-run)        MODE="dry-run" ;;
  --evidence-only)  MODE="evidence-only" ;;
  --append-log)     MODE="run" ;;
  "")               MODE="run" ;;
  *) echo "unknown arg: ${1}. Use --dry-run | --evidence-only | (none)"; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO_ROOT"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="docs/phase-7/run-logs"; LOG="$LOG_DIR/stripe-gate-$TS.md"; mkdir -p "$LOG_DIR"
OPERATOR="$(git config user.name 2>/dev/null || echo 'unknown')"

# Redact Stripe secrets + any connection string from a stream.
redact() {
  sed -E \
    -e 's/sk_(test|live)_[A-Za-z0-9]+/sk_\1_***REDACTED***/g' \
    -e 's/rk_(test|live)_[A-Za-z0-9]+/rk_\1_***REDACTED***/g' \
    -e 's/whsec_[A-Za-z0-9]+/whsec_***REDACTED***/g' \
    -e 's#postgres(ql)?://[^[:space:]"'"'"']*#postgres://***REDACTED***#g'
}
log(){ echo "$*" | redact | tee -a "$LOG" >&2; }
hr(){ log "-----------------------------------------------------------------"; }
declare -a RESULTS=()
record(){ RESULTS+=("$1"); }

# run "<name>" <cmd...> : execute, capture exit+timestamp, redact, record; fail-fast.
run(){
  local name="$1"; shift
  hr; log "▶ ${name}"; log "  cmd: $*"; log "  at: $(date -u +%H:%M:%SZ)"
  set +e; ( "$@" ) 2>&1 | redact | tee -a "$LOG"; local rc=${PIPESTATUS[0]}; set -e
  if [[ $rc -eq 0 ]]; then log "  ✅ PASS ($name)"; record "PASS  | $name"; else
    log "  ⛔ FAIL ($name) exit=$rc"; record "FAIL  | $name (exit $rc)"; summary; exit "$rc"; fi
}

summary(){
  hr; log "SUMMARY (stripe gate $TS)"; for r in "${RESULTS[@]}"; do log "  $r"; done; hr
}

write_log_header(){
  cat > "$LOG" <<EOF
# Phase 7 — Stripe TEST-mode Gate — Evidence Log

- **Timestamp (UTC):** ${TS}
- **Operator:** ${OPERATOR}
- **Environment:** local dev (\`.env.local\`), Supabase dev-gate \`borderpass-dev-gate\`
- **Stripe mode:** **TEST ONLY** (sk_test_ required; sk_live_ refused)
- **Scope:** rows 12 (offline smoke), 13 (PaymentIntent round-trip), 14 (webhook + idempotency). **Row 15 LIVE = NOT performed.**

## Commands run
(see redacted transcript below)

## Results
- Offline smoke: _pending_
- Env test-mode validation: _pending_
- PaymentIntent success path: _pending_
- Webhook received → payment succeeded: _pending_
- Order → paid only via webhook-driven server state: _pending_
- Duplicate webhook idempotency: _pending_
- Failed payment path → order remains unpaid: _pending_

## Ledger eligibility
- Eligible on success: rows 12, 13, 14.
- **Row 15 (Stripe LIVE validation): NOT performed — remains UNCHECKED.**

## Redacted transcript
EOF
}

# ---------------------------------------------------------------------------
write_log_header
hr; log "Phase 7 Stripe TEST-mode gate — ${TS} — DEVELOPMENT-ONLY (mode: ${MODE})"; hr

if [[ "$MODE" == "evidence-only" ]]; then
  log "Evidence-log skeleton written to: $LOG"; exit 0
fi

# 0. load .env.local (values never printed). Source crash-safe: dotenv values may contain stray
#    tokens; disable nounset and SUPPRESS stderr so a malformed line can never echo secret content.
if [[ -f .env.local ]]; then
  set +u; set -a
  # shellcheck disable=SC1091
  source ./.env.local 2>/dev/null || log "  ⚠ .env.local parse warning (unquoted value or stray \$ — single-quote all values); continuing"
  set +a; set -u
  log "  .env.local: loaded (values hidden)"
else log "  ⚠ .env.local ABSENT — set STRIPE_* test keys before the live round-trip"; fi

# 1. env presence by NAME only + TEST-mode enforcement
hr; log "▶ Validate Stripe env (names only; TEST mode enforced)"
missing=0
for v in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; do
  if [[ -n "${!v:-}" ]]; then log "  present: $v"; else log "  MISSING: $v"; missing=1; fi
done
# Refuse live; require test prefixes — checked WITHOUT printing values.
case "${STRIPE_SECRET_KEY:-}" in
  sk_live_*) log "  ⛔ sk_live_ detected — REFUSED. Test mode only."; record "FAIL  | env: sk_live_ refused"; summary; exit 1 ;;
  sk_test_*) log "  ✅ STRIPE_SECRET_KEY is sk_test_" ;;
  "")        log "  (STRIPE_SECRET_KEY unset — required before live round-trip)" ;;
  *)         log "  ⛔ STRIPE_SECRET_KEY is not sk_test_ — REFUSED."; record "FAIL  | env: secret not sk_test_"; summary; exit 1 ;;
esac
case "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" in
  pk_live_*) log "  ⛔ pk_live_ detected — REFUSED. Test mode only."; record "FAIL  | env: pk_live_ refused"; summary; exit 1 ;;
  pk_test_*) log "  ✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is pk_test_" ;;
  "")        log "  (publishable key unset — required for client/PWA payment page)" ;;
  *)         log "  ⛔ publishable key is not pk_test_ — REFUSED."; record "FAIL  | env: pk not pk_test_"; summary; exit 1 ;;
esac
case "${STRIPE_WEBHOOK_SECRET:-}" in
  whsec_*) log "  ✅ STRIPE_WEBHOOK_SECRET is whsec_" ;;
  "")      log "  (STRIPE_WEBHOOK_SECRET unset — set from 'stripe listen' before webhook validation)" ;;
  *)       log "  ⛔ STRIPE_WEBHOOK_SECRET malformed (expected whsec_)."; record "FAIL  | env: whsec_ malformed"; summary; exit 1 ;;
esac
record "PASS  | env test-mode validation (names only; sk_live_ refused)"

# 2. offline smoke (row 12) — runnable without live network
run "row12: offline stripe:smoke" pnpm --filter @maralito/payments stripe:smoke

# 3. dry-run stops here (no live round-trip)
if [[ "$MODE" == "dry-run" ]]; then
  hr; log "DRY-RUN — operator round-trip steps that WOULD run next:"
  cat <<'PLAN' | tee -a "$LOG"
  A. Terminal 1: pnpm dev            (app on http://localhost:3000)
  B. Terminal 2: stripe listen --forward-to http://localhost:3000/api/stripe/webhook
     → copy the printed whsec_… into STRIPE_WEBHOOK_SECRET in .env.local, restart app.
  C. Seed/reuse a SYNTHETIC accepted quote/order (no PII). See docs/phase-7/stripe-test-mode-runbook.md.
  D. Open the pay page → confirm with TEST card 4242 4242 4242 4242 (any future expiry / any CVC).
  E. Verify: webhook payment_intent.succeeded → payment succeeded → order 'paid' (webhook-driven only).
  F. Idempotency: `stripe events resend <evt_id>` (or replay) → no double cascade; second insert rejected by unique(stripe_event_id).
  G. Failed path: TEST card 4000 0000 0000 0002 (declined) → payment failed → order NOT paid.
PLAN
  summary; log "Dry-run complete. Offline checks passed; live round-trip not performed."
  exit 0
fi

# 4. operator-guided live TEST round-trip (rows 13/14). This script cannot click the UI or
#    receive webhooks for you; it prints the exact steps and records your observed outcomes.
hr; log "▶ OPERATOR round-trip (Stripe TEST mode) — follow docs/phase-7/stripe-test-mode-runbook.md"
log "  1) pnpm dev   2) stripe listen --forward-to http://localhost:3000/api/stripe/webhook"
log "  3) synthetic accepted quote → pay with TEST card 4242 4242 4242 4242"
log "  4) confirm webhook succeeded → order paid (webhook-driven)   5) replay event (idempotency)   6) declined card 4000…0002 (order stays unpaid)"
log ""
log "  Record observed outcomes (y/n) — nothing secret is captured:"
ask(){ local q="$1" ans; read -r -p "$q [y/N]: " ans || true; [[ "${ans:-}" =~ ^[Yy] ]] && echo yes || echo no; }
R_INIT=$(ask "row13: PaymentIntent initiated from accepted quote?")
R_SUCCESS=$(ask "row13: payment confirmed with TEST 4242 (success)?")
R_WEBHOOK=$(ask "row14: webhook marked payment succeeded?")
R_PAID=$(ask "row14: order moved to paid ONLY via webhook-driven server state?")
R_IDEM=$(ask "row14: duplicate/replayed webhook was idempotent (no double cascade)?")
R_FAIL=$(ask "row14: failed/declined payment left order UNPAID?")

# 5. finalize evidence + eligibility
{
  echo; echo "## Observed outcomes"
  echo "- PaymentIntent initiated: $R_INIT"
  echo "- Success path (TEST 4242): $R_SUCCESS"
  echo "- Webhook → payment succeeded: $R_WEBHOOK"
  echo "- Order paid only via webhook-driven state: $R_PAID"
  echo "- Duplicate webhook idempotent: $R_IDEM"
  echo "- Failed payment left order unpaid: $R_FAIL"
  echo
  echo "## Ledger rows eligible for update (only if TRUE with this evidence)"
  [[ "$R_SUCCESS" == yes ]] && echo "- Row 13 ELIGIBLE (offline smoke + TEST PaymentIntent success)" || echo "- Row 13 NOT eligible"
  { [[ "$R_WEBHOOK" == yes && "$R_PAID" == yes && "$R_IDEM" == yes && "$R_FAIL" == yes ]] && echo "- Row 14 ELIGIBLE (webhook + idempotency + failed-path)"; } || echo "- Row 14 NOT eligible"
  echo "- Row 12 ELIGIBLE (offline smoke passed above)"
  echo
  echo "## Not performed"
  echo "- **Row 15 (Stripe LIVE validation): NOT performed — remains UNCHECKED.** Requires explicit owner approval + live keys, out of scope for this test-mode gate."
} | tee -a "$LOG"

record "row13 success=$R_SUCCESS"; record "row14 webhook=$R_WEBHOOK paid=$R_PAID idem=$R_IDEM failUnpaid=$R_FAIL"
summary
log "Evidence log: $LOG"
log "Update docs/phase-7/gate-ledger.md ONLY for rows marked ELIGIBLE above. Row 15 stays unchecked. BorderPass remains development-only."
