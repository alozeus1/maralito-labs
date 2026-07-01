# 20 · Developer Workflow Authoring Experience

Covers required output **(22)**. Realizes capability 12 and Principle A12 (authoring is a product). The goal: a developer can **define, test, simulate, debug, and ship** a workflow safely and quickly — and reuse templates so new apps start fast.

---

## 22.1 Workflow definition format
- Workflows are authored in **TypeScript** via a typed builder SDK (`@maralito/automation`), producing the **declarative spec** stored in `workflow_definitions` (§17). Type-safety + reuse of `@maralito/schemas`; the declarative output stays inspectable/diffable/simulatable (decision in [§02](./02-workflow-architecture.md)).
- A definition declares: trigger, input schema (Zod), steps (with type, retry, timeout, compensation), branches (rules refs), permissions, SLA, and on-error policy.
- **Agents, tools, rule sets, approval policies, templates** are referenced by key+version — never inlined — so they're independently versioned and reusable.

```text
// conceptual authoring shape (not final API)
defineWorkflow({
  key: "borderpass.order.intake", version: 7, app: "borderpass",
  trigger: onEvent("borderpass.order.submitted"),
  input: OrderIntakeInput,                 // Zod
  permissions: { effects: ["notifications.send"], data: ["orders:read"] },
  steps: (s) => [
    s.function("validate", validateOrder, { retry: thrice, onFailure: "reject" }),
    s.subworkflow("risk", "borderpass.compliance.risk_review"),
    s.branch("byRisk", riskRuleSet, {
      HIGH: s.approval("compliance", { policy: "borderpass.compliance.high" }),
      else: s.subworkflow("quote", "borderpass.quote.generate"),
    }),
    s.effect("notify", notifyCustomer, { compensation: undoNotify }),
  ],
})
```

## 22.2 Workflow testing
- **Unit-test steps** (pure functions, rule sets) with Vitest; rule sets ship with fact→expected cases (gate in CI).
- **Workflow tests**: drive a definition through the engine's **test harness** with mocked effects/agents; assert the path taken, branches, compensation on injected failures, and idempotency on retried steps.
- **Contract tests**: event/input schemas stay compatible across versions; agent/tool permission grants validated.
- **Failure-path tests are required** (chaos): engine restart mid-run resumes; effect failure compensates; event redelivery is idempotent ([§11](./11-retry-failure-recovery.md)).

## 22.3 Local workflow simulation
- **One-command local stack** (`pnpm dev`): app + automation engine local dev server + Postgres branch + Upstash dev + mocked/test providers.
- **Simulator**: run a definition against sample or **recorded historical input** with effects mocked and agents stubbed/replayed from fixtures → see the resulting path, decisions (rules), and timings without touching real systems or money.
- **Time control**: fast-forward timers/sleeps so long-running workflows (multi-day crossing) are testable in seconds.
- **Deterministic agent mode**: agents replay recorded responses / use cheap test models for repeatable tests.

## 22.4 Workflow dashboard (authoring side — ties to §19)
- Definition browser with **version diffs**; visual render of the step graph from the spec.
- Trigger a **simulation run** from the UI and watch the path; inspect each step's I/O.
- Promote draft → published with required checks (validation, tests, review, separation of duties).

## 22.5 Agent debugging
- **Agent run explorer** (§19): per-step reasoning, tool calls, inputs/outputs (redacted), guardrail outcomes, cost, latency.
- **Replay an agent run** with the same inputs to reproduce behavior; diff against a new prompt/agent version.
- **Eval runner**: run regression/red-team suites locally and in CI; see quality + cost deltas before promoting.

## 22.6 Replay tools
- **Run replay**: read-only (debug, no effects) or effectful (recovery, idempotency-respecting) — from the dashboard or CLI.
- **Event replay**: reprocess a historical event or DLQ batch after a fix.
- Replays are permissioned + audited; effectful replays clearly flagged.

## 22.7 Template workflows
- A **library of starter templates** for the reusable spine: `intake`, `risk-review`, `quote`, `payment`, `task-then-continue`, `approval-gate`, `notify`, `scheduled-followup`, `refund/compensation`.
- New apps scaffold from templates via CLI (`maralito automation new-workflow --template intake`) → a working, testable definition wired to platform services.
- Templates encode best practices (idempotency, compensation, audit, least privilege) so authors inherit them by default.

## 22.8 Documentation
- **Event catalog** + **workflow/agent/rule/approval registries** auto-published (from schemas) in the dev docs portal.
- Authoring guide, testing/simulation guide, replay/runbook docs, and "how to add a workflow to a new app" guide.
- Every workflow/agent/rule has owner + description + changelog.

## 22.9 CLI (`@maralito/automation` + platform CLI)
| Command | Purpose |
|---------|---------|
| `automation new-workflow --template <t>` | Scaffold a workflow |
| `automation new-agent` / `new-ruleset` / `new-policy` | Scaffold registry items |
| `automation simulate <key> --input fixture.json` | Local simulation |
| `automation test` | Run workflow/step/rule/eval tests |
| `automation validate <key>` | Validate spec (reachability, permissions, schemas) |
| `automation publish <key>@<v>` | Publish (gated) |
| `automation replay <runId> --mode read_only` | Replay for debugging |

## 22.10 Acceptance criteria (DX)
`ACCEPTANCE:`
- A developer can scaffold, simulate (with time fast-forward + mocked effects), and unit/chaos-test a workflow locally with one command.
- Definitions are type-safe, declarative, version-diffable, and reference agents/rules/policies/templates by key.
- Agent runs are replayable and eval-gated before promotion.
- Effectful replays are permissioned, audited, and idempotency-respecting.
- A new app can author a production workflow from templates in days, inheriting idempotency/compensation/audit/least-privilege by default.
