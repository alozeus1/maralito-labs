# 19 · Admin Dashboard Requirements

Covers required output **(21)**. The operational cockpit for the automation platform — where ops/admins/support run the business and engineers debug workflows. Built as a Maralito **admin app** (Next.js) consuming the automation APIs (§18).

---

## 19.1 Audiences & their jobs
| Audience | Needs to… |
|----------|-----------|
| **Ops / staff** | Work tasks, monitor running workflows, handle exceptions/escalations |
| **Approvers (finance/compliance/admin)** | See and action approval queues with context |
| **Support** | Find a customer's process state, escalate, resolve |
| **Engineers / automation authors** | Inspect, debug, replay runs; manage definitions/agents/rules |
| **Leadership** | See throughput, SLAs, cost, agent performance |

## 19.2 Core modules

### 1. Workflow Runs Console
- **List/search** runs by status, workflow, app, subject, correlation_id, date; saved filters.
- **Run detail**: visual **state graph + timeline**, per-step input/output (redacted), retries, durations, current wait reason, linked agent runs/approvals/tasks/events.
- **Actions** (permissioned + audited): signal, resume, retry step, cancel+compensate, replay (read-only/effectful), override/skip.
- **"Stuck runs" view**: runs waiting beyond expected, with one-click triage.

### 2. Approvals Queue
- Role-scoped inbox (finance/compliance/admin), sorted by priority + SLA countdown.
- Decision view with full **context panel** (subject, AI rationale, documents, history), approve/reject/request-changes + comment, reassign/escalate.
- Bulk actions where safe; separation-of-duties enforced (can't self-approve).

### 3. Task Queues
- Per-queue boards (inspectors/drivers/finance/support) with priority + SLA.
- Claim/assign/work/complete with structured result + attachments; mobile-friendly for field roles.
- Supervisor view: load per worker, SLA breaches, reassignment.

### 4. Agent Operations
- **Agent run explorer**: per run/step model, tokens, **cost**, latency, tool calls, guardrail outcomes, verdict, approval waits.
- **Quality**: eval scores over time, online scores, **human-override rate** (how often approvers reject agent suggestions).
- **Registry**: agents/tools/prompts with versions, autonomy tier, permissions.

### 5. Approvals/Rules/Policies Admin
- Manage approval policies, rule sets (with **simulation/impact analysis** before publish), feature flags gating rules.
- Change history + audit on every policy/rule change (these affect money/compliance).

### 6. Events & DLQ
- Event stream explorer (by correlation/subject/type); causal graph of a business process.
- **DLQ console**: inspect failed events/steps, error + attempts, **replay/discard** (audited).

### 7. Schedules & Integrations
- Schedule list (next/last run, status, pause/resume/run-now).
- Integration registry health: inbound webhook success rates, outbound circuit-breaker state, recent failures.

### 8. Observability & Cost
- Dashboards: workflow throughput/duration/success, SLA adherence, stuck counts, DLQ depth.
- **Cost dashboard**: spend by workflow/agent/model/channel per app/org with budget burn + anomaly alerts.
- Links into Sentry/OTel traces and PostHog.

### 9. Authoring & Simulation (engineer-facing — ties to §20)
- Workflow/agent/rule **definition browser + diff** across versions.
- **Simulation runner**: execute a definition against sample/historical input with effects mocked; view the resulting path + decisions.
- Replay tooling surfaced alongside run detail.

## 19.3 Cross-cutting dashboard requirements
- **Tenant + app aware**: every view scoped by org/app; Maralito admins can cross-org (audited).
- **RBAC**: modules/actions gated by role; powerful actions require elevation.
- **Real-time**: live updates for runs/queues/approvals (subscriptions).
- **Audit-visible**: who did what in the dashboard is itself audited.
- **Redaction**: sensitive inputs/PII masked by default; reveal is permissioned + logged.
- **Accessibility + i18n**: built on the shared UI kit (EN/ES).
- **Deep-linkable**: every run/approval/task/agent-run has a stable URL (for support + incident sharing).

## 19.4 MVP vs later
| MVP | Later (v1+) |
|-----|-------------|
| Runs console (list + detail + basic actions), approvals queue, task queues, DLQ, basic cost/throughput | Agent quality dashboards, rule/policy simulation UI, authoring/diff, advanced cost anomaly, cross-app leadership view |

## 19.5 Acceptance criteria (dashboard)
`ACCEPTANCE:`
- An operator can find any run by correlation_id and see its full timeline + take a permissioned, audited action.
- Approvers can action their queue with full context and SLA visibility; no self-approval.
- Field workers can complete tasks with attachments on mobile.
- DLQ items are inspectable and replayable from the UI.
- Cost + SLA + stuck-run dashboards exist; all dashboard actions are RBAC-gated and audited.
