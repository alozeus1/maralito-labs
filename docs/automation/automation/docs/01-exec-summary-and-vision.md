# 01 · Executive Summary & Vision

Covers required outputs **(1)** executive automation summary and **(2)** automation platform vision.

---

## 1 · Executive automation summary

### The problem
Every Maralito app runs the same shape of operational process: something happens (a customer submits a request, a payment clears, a package arrives), and a chain of work must follow — validate, assess risk, maybe get a human to approve, generate a document, charge a card, create an operations task, assign a person, notify the customer, and record everything. Built ad-hoc inside each app, these chains become brittle scripts: no retries, no visibility, no audit, no reuse, and no safe place to insert AI or human judgment.

### The solution
The **Maralito Automation Platform** is a durable **workflow + automation layer** that turns those chains into **defined, versioned, observable workflows**. It sits on top of the Maralito Platform services and orchestrates them: it reacts to **events**, runs **AI agents** and deterministic steps, pauses for **human approvals**, fires **notifications**, triggers **payments**, produces **documents**, creates **operations tasks**, and writes **audit + analytics** — all with retries, timeouts, escalations, compensation, and full replay.

### What it provides (the twelve capabilities)
1. **Event Bus** — standard event format, producers/consumers, retries, DLQ, idempotency, history.
2. **Workflow Engine** — long-running workflows, human steps, schedules, branching, retries, timeouts, escalations, compensation/rollback, versioning.
3. **AI Agent Orchestration** — LangGraph manager, agent + tool registries, agent permissions/memory/handoffs, evaluation, observability, HITL, guardrails.
4. **Task Management** — staff/inspector/driver/finance/support queues, priority, SLA timers, escalation, assignment logic.
5. **Notification Automation** — email/WhatsApp/SMS/in-app/push, templates, triggers, delivery tracking, retries.
6. **Approval System** — manual/admin/compliance/finance/refund/high-risk approvals, history, comments.
7. **Rules Engine** — business/risk/pricing/compliance rules, app- and tenant-specific, feature-flagged.
8. **Scheduling** — cron, delayed jobs, reminders, SLA reminders, follow-ups, recurring workflows.
9. **Integration Layer** — Stripe/Supabase/WhatsApp/email webhooks, webhook ingestion, external + internal calls.
10. **Audit & Observability** — workflow/agent/approval/event logs, error tracking, replay, metrics, agent performance, cost.
11. **Security** — workflow/tool/agent permissions, secrets, data-access limits, audit trails, abuse prevention, rate limiting.
12. **Developer Experience** — workflow definition format, testing, local simulation, dashboard, agent debugging, replay, templates, docs.

### Core design stance
- **Durable-by-default.** Workflows survive restarts; every step is retryable and idempotent; nothing important runs in a fire-and-forget request handler.
- **Events in, effects out.** Workflows are triggered by events and cause effects through platform services and new events — never by tightly-coupled synchronous chains.
- **AI is a step type, governed centrally.** Agents run as workflow steps through the platform AI gateway (cost, guardrails, memory, approvals inherited). No agent acts on the world unsupervised above a risk threshold.
- **Humans are a step type.** Approvals and tasks are first-class, durable steps — a workflow can pause for days waiting on a person and resume cleanly.
- **Reusable, multi-tenant, multi-app.** One engine, one event model, one agent fabric; workflows are org- and app-scoped; BorderPass is the first tenant, not the mold.
- **Observable and auditable end-to-end.** Every workflow run, agent step, approval, and event is traced, logged, audited, replayable, and cost-attributed.

### Phasing at a glance (detail in [Roadmap](./21-roadmap.md))
- **MVP:** event bus + durable workflow engine + human approval steps + task queues + notification triggers + audit/observability + 3–4 BorderPass workflows (intake → risk → approval → quote → payment → ops task).
- **v1:** full agent orchestration (LangGraph, registries, memory, handoffs, eval), rules engine, scheduling, compensation/rollback, all 12 BorderPass workflows, admin dashboard, authoring SDK + simulation.
- **Future:** higher autonomy tiers, cross-app orchestration, workflow marketplace/templates, advanced agent evaluation, multi-region.

### Success criteria
- A BorderPass order flows **end-to-end through defined workflows** with retries, approvals, notifications, payment, and audit — no bespoke glue code.
- A **new app** can author a production workflow reusing the engine, events, agents, tasks, and approvals in **days**, with zero re-implementation of orchestration.
- **One pane** shows every running workflow, every pending approval/task, every agent run, and the cost of all of it.
- Any failed or suspicious run can be **inspected and replayed**.

---

## 2 · Automation platform vision

> **Maralito Labs operations run as defined, supervised, self-healing workflows — where software does the deterministic work, AI agents do the judgment-heavy work under guardrails, and humans approve only what genuinely needs a human — so every app can automate complex operations safely and launch new automations in days.**

### What becomes true
- **Operations are programs, not tribal knowledge.** "How an order is handled" is a versioned workflow definition, testable and reviewable, not steps in people's heads.
- **AI is inserted safely.** Adding an AI agent to a process is dropping a governed step into a graph — it inherits cost tracking, guardrails, memory, evaluation, and human approval automatically.
- **Humans supervise, not babysit.** People are pulled in for approvals and exceptions through clean queues with SLAs and escalation — not to manually shepherd every case.
- **Nothing silently fails.** Retries, timeouts, escalations, compensation, DLQs, and replay mean a stuck or failed process is visible and recoverable, not lost.
- **Reuse compounds.** The intake→risk→approval→quote→pay→fulfill→notify→audit spine is built once and specialized per app, so each new product starts most of the way there.

### Anti-vision (what we will not build)
- Not a no-retry, no-visibility pile of cron jobs and webhook handlers glued into apps.
- Not unsupervised autonomous agents making irreversible decisions (payments, refunds, border/compliance calls) without guardrails and human approval.
- Not a BorderPass-specific operations backend — BorderPass workflows are the proving ground, not the definition.
- Not a second, competing event/notification/payment stack — it **reuses** the platform services.

### Guiding principles
- **A1 — Durability over cleverness.** Every workflow is restart-safe and replayable; correctness under failure beats elegant-but-fragile.
- **A2 — Idempotency everywhere.** Steps assume at-least-once execution; re-running a step has no extra effect (keyed by run + step).
- **A3 — Events are the contract.** Workflows integrate via versioned events, not by reaching into each other or into app internals.
- **A4 — AI under governance.** All agent steps go through the AI gateway; high-risk agent actions require human approval (A6).
- **A5 — Least privilege per step.** Workflows, tools, and agents get only the permissions and data their step needs, scoped by org + app.
- **A6 — Humans for judgment and irreversibility.** Risky, costly, or irreversible actions require a human approval step by default until explicitly trusted.
- **A7 — Everything observable, auditable, replayable.** If we can't trace, audit, and replay it, we don't ship it.
- **A8 — Versioned and backward-compatible.** Running workflows pin their version; new versions don't break in-flight runs.
- **A9 — Compensate, don't corrupt.** When a multi-step process fails partway, defined compensation/rollback steps undo side effects rather than leaving inconsistent state.
- **A10 — Reusable and tenant-aware.** Built once for all apps; every run carries org + app context and respects tenant isolation.
- **A11 — Cost is a first-class signal.** Agent/model/notification/step cost is tracked and attributable per workflow, app, and org.
- **A12 — Authoring is a product.** Defining, testing, simulating, and debugging a workflow is a first-class, pleasant developer experience.
