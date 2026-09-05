# Preview Branching — Current State and Proposal

> **Phase 10 / Phase-4 evidence task.** Documents the preview → database/secret mapping as it is
> today, records a drift against the owner-signed decision, and proposes the isolation model.
>
> **Nothing here enables, provisions or tears down anything.** Selecting and enabling a model
> requires explicit owner approval. `docs/phase-7/decision-preview-branching.md` (ledger row 17)
> remains the governing decision record.

---

## 1. Drift against the signed decision

`decision-preview-branching.md` is owner-signed (Godwill, 2026-07-01) and selects **Option C —
defer**: *"defer preview environments entirely; validate via local Pass 2 + the manual `live-gates`
workflow."*

**Observed reality: Vercel preview deployments run on every pull request.** They were observed
building and reaching `Ready` on PRs #34 and #35 on 2026-09-05, with a stable preview URL per branch.

This is **Option A in practice** (previews against a shared database), not Option C. That is not
necessarily wrong — Option A is explicitly permitted *"only for non-PII development testing with
synthetic data, with clear 'shared DB — no isolation' labeling"* — but it was never ratified, and the
labeling condition is not met. **The signed record and the running system disagree, and the record
should be reconciled by the owner rather than quietly by us.**

Two conditions attached to the deferral have also moved:

| Condition | State 2026-07-01 | State now |
|---|---|---|
| Env/secrets review (row 18) complete | open | ✅ **CLOSED** (owner-attested 2026-07-15) |
| Isolation model (A vs B) chosen | open | 🔲 still open |

So the deferral now rests on a single remaining condition. Choosing A or B is the decision that
retires row 17's "revisit" clause.

**Also stale:** the decision document refers throughout to *"all 7 RLS files"*. The canonical registry
now holds **12**. Any preview automation copied from that document would under-apply policies by five
files — precisely the D1 fail-open class the registry was built to prevent.

---

## 2. Current mapping, as far as it is verifiable offline

| Aspect | Current state | How verified |
|---|---|---|
| Preview compute | Vercel, one deployment per PR/branch | Observed on PRs #34/#35 |
| Preview database | Presumed shared `borderpass-dev-gate` | **UNVERIFIED** — requires Vercel env access, which needs owner approval |
| Preview secrets | Presumed scoped, non-production | **UNVERIFIED** — same |
| Repo Vercel config | none in repo (`vercel.json` absent) | `ls` |
| Env contract | `.env.example` | read |
| Teardown | none defined | `decision-preview-branching.md` §Decision |

**The database and secret mapping is asserted, not proven.** Confirming it means reading the Vercel
project's Preview-scope environment variables, which is an external read this task may not perform
without approval. It is recorded here as **UNVERIFIED**, not as "shared dev-gate".

### 🔴 Finding — the preview email safety net was fail-open and undocumented

`apps/borderpass/src/server/resend.ts`:

```ts
export function isDeliveryEnabled(): boolean {
  return process.env.EMAIL_DELIVERY_ENABLED !== 'false';
}
```

Delivery is enabled unless the variable is **exactly** the string `'false'`. Recipient redirection
(`EMAIL_SAFE_RECIPIENT`) is likewise opt-in. **Neither variable appeared in `.env.example`.** An
environment provisioned from that template with a `RESEND_API_KEY` present therefore emails **real
recipients** — no typo required, just an omission.

This is the "real email sent from preview" failure mode in `plan.md` §5, and the mechanism makes it
likely rather than hypothetical. **Fixed in this change set:** both variables are now in
`.env.example` with safe non-production defaults and an explicit warning that the behaviour is
fail-open.

**Still required (owner):** confirm that the running Preview environment actually sets
`EMAIL_DELIVERY_ENABLED=false` **and** `EMAIL_SAFE_RECIPIENT`. Until confirmed, treat previews as
capable of emailing real people.

---

## 3. Proposal — shared-dev (A) versus per-PR (B)

| | **Option A — shared dev-gate** | **Option B — per-PR Supabase branch** |
|---|---|---|
| Isolation | None. One bad migration or seed affects every open PR | Per-PR. Schema and data changes are contained |
| Migration application | Manual/ad-hoc against a long-lived project | Automated per branch, reusing the `live-gates.yml` pattern |
| RLS application | Must apply all **12** registry files; drift risk on a long-lived project | Applied fresh per branch from `registry.mjs --list`, so drift cannot accumulate |
| Teardown | None — state accretes indefinitely | On PR close |
| Cost / complexity | Low | Higher: provisioning, per-branch secret scoping, teardown |
| Data | Synthetic only | Synthetic only |
| Fit | Acceptable for non-PII synthetic testing **if labelled** | The target once staging exists |

**Recommendation: A now, B before staging — with three conditions on A.**

Option B is the right end state, but it is real operational work and nothing in the current critical
path (B0 → B3 → B4 → B2 in `plan.md`) is blocked by preview isolation. Formalising A, with the
conditions below, converts an unratified drift into a bounded, honest position at near-zero cost.

**Conditions on adopting A:**

1. **Label it.** Previews must visibly indicate "shared database — no isolation, synthetic data
   only", satisfying the condition the signed decision already attached to Option A.
2. **Prove the email safety net.** `EMAIL_DELIVERY_ENABLED=false` and `EMAIL_SAFE_RECIPIENT` set in
   the Preview scope, verified — not assumed (§2).
3. **Apply policies from the registry, never a hand-typed list.** Any preview automation must read
   `registry.mjs --list`. The "7 files" figure in the decision record must be corrected to 12 first.

**Move to B when** any of these becomes true: a staging environment exists; previews need
non-synthetic-shaped data; or two PRs need conflicting migrations simultaneously.

**Never, under either option:** real PII, production credentials, live Stripe keys, or a server-only
secret exposed through `NEXT_PUBLIC_*`.

---

## 4. What the owner must decide

- [ ] Reconcile the record: previews are running, which the signed decision defers. Ratify A (with
      §3's three conditions) or genuinely disable previews.
- [ ] Confirm the Preview database target and secret scoping (§2 — currently UNVERIFIED).
- [ ] Confirm the Preview email safety variables are actually set.
- [ ] Correct "7 RLS files" → 12 in `decision-preview-branching.md` before any automation copies it.
- [ ] Choose the trigger for moving to B.

Until these are answered, **no preview-based readiness may be claimed**, and previews must be assumed
to share one database and to be capable of sending email.
