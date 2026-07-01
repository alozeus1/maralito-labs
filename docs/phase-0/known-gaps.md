# Phase 0 — Known Gaps

| # | Gap | Impact | Resolve by |
|---|-----|--------|-----------|
| 1 | **Empty leftover dirs** (`borderpass/`, `maralito-platform/`) couldn't be deleted (sandbox mount: "Operation not permitted"). All 104 docs migrated; shells are empty. | Cosmetic | Delete on the host or in Phase 1 cleanup |
| 2 | **Cross-folder doc links** (e.g. `../contracts/...`) may break after relocation; same-folder links preserved | Doc navigation only | Link-fix pass (Phase 1, non-blocking) |
| 3 | **`@maralito/sdk` surface** is a typed placeholder | Blocks Phase 1 BFF wiring | Confirm with platform team before Phase 1 |
| 4 | **Dependency versions** are caret ranges, not SHA/lock-pinned; `pnpm-lock.yaml` not generated in sandbox (no full install run) | Reproducibility | `pnpm install` in real env → commit lockfile; pin CI actions by SHA |
| 5 | **Full Postgres + Inngest-dev-server** spike run pending (sandbox has no Postgres/Docker) | Confidence | Run in a real dev env at start of Phase 2 (AI) |
| 6 | **Token gaps** (warning/info/gold hex; modal/sheet shadows) | Visual completeness | Confirm before Phase 2 |
| 7 | **Supabase preview-branching vs ephemeral schemas** for CI | Preview env | Decide before Phase 1 CI |
| 8 | **semgrep ruleset tuning** (auto config may be noisy) | CI noise | Tune in Phase 1 |

> None of these block the Phase 0 deliverable. Items 3, 7 gate Phase 1; item 5 gates Phase 2 AI.
