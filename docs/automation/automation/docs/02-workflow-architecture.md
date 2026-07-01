# 02 · Workflow Architecture

Covers required output **(3)**.

---

## 2.1 Architectural layers

The automation platform is a **control plane** (define, trigger, observe workflows) plus a **durable execution plane** (run them reliably) sitting on top of platform services.

```mermaid
graph TB
  subgraph Triggers["Triggers"]
    APPEVT[App events - BorderPass etc.]
    WEBHOOK[External webhooks - Stripe/Twilio/WA]
    SCHED[Schedules - cron/delayed]
    MANUAL[Manual / API trigger]
  end

  subgraph Control["Control Plane"]
    REG[Workflow registry + versions]
    TRIG[Trigger router / subscriptions]
    RULES[Rules engine]
    DASH[Admin dashboard + authoring]
  end

  subgraph Exec["Durable Execution Plane"]
    ENGINE[Workflow engine - Inngest/Trigger.dev]
    STEPS[Steps: function | agent | approval | wait | signal]
    STATE[(Run state + checkpoints)]
    DLQ[(Dead-letter queue)]
  end

  subgraph StepTypes["Step executors"]
    FN[Deterministic functions]
    AGENT[AI agents - LangGraph via AI gateway]
    HUMAN[Human approval / task]
    EFFECT[Platform effects]
  end

  subgraph Platform["Maralito Platform services"]
    EVB[(Event Bus)]
    AI[AI Platform]
    NOTIF[Notifications]
    PAY[Payments]
    FILES[Files]
    AUDIT[Audit]
    ANALYTICS[Analytics]
    IDN[Identity/RBAC/RLS]
  end

  APPEVT --> EVB --> TRIG
  WEBHOOK --> TRIG
  SCHED --> TRIG
  MANUAL --> TRIG
  TRIG --> RULES --> ENGINE
  REG --> ENGINE
  ENGINE --> STEPS
  STEPS --> FN
  STEPS --> AGENT --> AI
  STEPS --> HUMAN
  STEPS --> EFFECT
  EFFECT --> NOTIF
  EFFECT --> PAY
  EFFECT --> FILES
  ENGINE --> STATE
  ENGINE --> DLQ
  ENGINE --> EVB
  ENGINE -.audit.-> AUDIT
  ENGINE -.metrics.-> ANALYTICS
  ENGINE -.authz.-> IDN
  DASH --> REG
  DASH --> ENGINE
```

## 2.2 Core concepts

| Concept | Definition |
|---------|------------|
| **Workflow definition** | A versioned, declarative description of a process: its trigger, steps, branches, timeouts, compensation, and permissions. |
| **Workflow run (instance)** | A single execution of a definition for a specific subject (e.g., order `ord_123`), carrying `org_id`/`app_id`, state, and history. |
| **Step** | One unit of work. Types: **function** (deterministic), **agent** (AI), **approval** (human gate), **task** (human work), **wait/sleep**, **signal/await-event**, **effect** (call a platform service), **sub-workflow**. |
| **Trigger** | What starts a run: an event, a schedule, a webhook, or a manual/API call. |
| **Signal** | An external input delivered to a running workflow (approval decision, webhook, customer reply) that resumes a waiting step. |
| **Compensation** | A defined "undo" for a step's side effects, run when a later step fails (saga pattern). |
| **Checkpoint** | Persisted state after each completed step so the run can resume exactly where it left off. |

## 2.3 Workflow definition model (conceptual, not code)

A definition is data, not a script — so it can be versioned, validated (Zod), visualized, simulated, and reviewed:

```text
Workflow {
  key: "borderpass.order.intake"      // stable identifier
  version: 7                           // immutable once published
  trigger: { type: "event", event: "borderpass.order.submitted" }
  scope: { app: "borderpass" }         // org resolved per run
  input_schema: Zod                    // validated at start
  permissions: { roles, tools, data_scopes }
  steps: [
    { id, type, on_success, on_failure, retry, timeout, compensation, ... }
  ]
  sla: { ... }
  on_error: "escalate" | "compensate" | "dlq"
}
```

`DECISION:` Workflows are **defined in TypeScript using a typed builder/SDK** (durable-engine native), **but constrained to a declarative shape** (steps as data) so they remain testable, simulatable, and renderable in the dashboard. Rationale: TS gives type-safety and reuse of `@maralito/schemas`; the declarative constraint keeps them inspectable and version-diffable. Alternative — a YAML/JSON DSL — is more portable but loses type-safety and forces a custom interpreter; revisit only if non-engineers must author workflows. `⚠️ VERIFY` the chosen engine's authoring ergonomics and step-durability guarantees.

## 2.4 Execution model

- **Durable steps:** the engine persists progress after each step; on crash/restart it resumes from the last checkpoint, never re-running completed side effects (idempotency keys protect partial steps).
- **Long-running & waiting:** a run can `sleep` (delays/SLA timers) or `waitForSignal` (approval, webhook, customer action) for seconds to weeks without holding compute.
- **Concurrency & fan-out:** steps can run in parallel (e.g., notify customer + create ops task) and fan-out (e.g., assign N inspection sub-tasks), with concurrency/throttle controls per org (noisy-neighbor protection).
- **Branching:** conditional transitions driven by step output and the **rules engine** (e.g., "if risk ≥ high → approval step").
- **Sub-workflows:** a workflow can start and await child workflows (e.g., intake starts `delivery` workflow), enabling composition and reuse.

## 2.5 Separation of concerns

| Layer | Responsibility | Where it lives |
|-------|----------------|----------------|
| Trigger router | Map events/schedules/webhooks → workflow runs; apply trigger rules | Control plane (platform event bus + router) |
| Workflow engine | Durable execution, retries, timeouts, state, DLQ | Inngest/Trigger.dev |
| Step executors | Run the actual function/agent/approval/effect | Platform services + AI gateway |
| Rules engine | Evaluate branch/risk/pricing/eligibility decisions | Automation platform (§07) |
| Observability | Trace/log/metric/replay every run | Sentry + OTel + PostHog + audit |
| Authoring/Dashboard | Define, test, simulate, monitor, replay | Admin app (§19, §20) |

## 2.6 Why a dedicated workflow engine (not app-coded chains)

`DECISION:` Use a **durable execution engine** (Inngest/Trigger.dev) rather than hand-rolled queues + cron in each app.
- Built-in step durability, retries, backoff, sleep, fan-out, concurrency, and replay — the hard parts of reliable orchestration.
- Workflows survive deploys and crashes; in-flight runs aren't lost.
- One operational surface for all apps' automations.
- **Alternative considered:** raw Upstash queues + custom state machine. More control, far more undifferentiated heavy lifting and bug surface; rejected for core orchestration. We still use **Upstash** for caching, rate limiting, idempotency keys, and lightweight queues. `⚠️ VERIFY` engine max step/run duration, concurrency limits, pricing, and self-host options before committing — these shape long-running workflows (e.g., a border crossing that spans days).

## 2.7 Relationship to the platform event bus

The automation platform does **not** introduce a second event system. It **consumes and emits** events on the platform Event Bus ([../docs/06](../docs/06-api-and-events.md)). The workflow engine is a privileged event **consumer** (it subscribes to triggers) and **producer** (it emits workflow lifecycle + domain events). The standard event schema is defined in [§03](./03-event-bus-and-schema.md).
