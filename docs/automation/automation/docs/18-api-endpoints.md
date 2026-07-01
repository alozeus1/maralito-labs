# 18 · API Endpoints Needed

Covers required output **(20)**. Endpoints the automation platform exposes. All are consumed primarily through `@maralito/sdk` (internal) or the public API (partners); all enforce authN + RBAC + tenant context + Zod validation + rate limits (platform §06/§12). Paths are illustrative (`/v1/automation/...`).

> Convention: mutating endpoints accept an `Idempotency-Key`. All responses are typed; errors use the standard error shape (`code`, `message`, `request_id`, `trace_id`).

---

## 18.1 Workflow definitions (authoring/control plane)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/workflows` | Create a draft workflow definition |
| PUT | `/workflows/{key}/versions/{v}` | Update a draft version |
| POST | `/workflows/{key}/versions/{v}/publish` | Publish (immutable) a version |
| POST | `/workflows/{key}/deprecate` | Deprecate / retire |
| GET | `/workflows` · `/workflows/{key}` · `/workflows/{key}/versions/{v}` | List / read definitions |
| POST | `/workflows/{key}/simulate` | Dry-run against sample input (no effects) — see DX §20 |
| POST | `/workflows/{key}/validate` | Validate spec (schema, reachability, permissions) |

## 18.2 Workflow runs (execution)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/runs` | Start a run (manual/API trigger) `{workflowKey, input, subject}` |
| GET | `/runs` | List/filter runs (status, subject, correlation, app) |
| GET | `/runs/{id}` | Run detail (state, timeline, steps) |
| GET | `/runs/{id}/steps` · `/runs/{id}/events` | Step + event history |
| POST | `/runs/{id}/signal` | Deliver a signal (resume a waiting run) `{name, payload}` |
| POST | `/runs/{id}/cancel` | Cancel + compensate |
| POST | `/runs/{id}/resume` | Resume a stuck run from checkpoint |
| POST | `/runs/{id}/retry-step` | Retry a failed step |
| POST | `/runs/{id}/replay` | Replay (mode: read_only / effectful) |
| POST | `/runs/{id}/override` | Operator step skip/override (elevated + audited) |

## 18.3 Events & integration
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Publish an event (internal producers) |
| GET | `/events` | Query event history (by correlation/subject/type) |
| POST | `/webhooks/{provider}` | Inbound webhook ingestion (Stripe/Twilio/WhatsApp/Resend/custom) — signature-verified |
| GET | `/dlq` · POST `/dlq/{id}/replay` · POST `/dlq/{id}/discard` | DLQ inspect + remediate |
| GET/POST | `/integrations` | Manage integration registry entries |

## 18.4 Agents
| Method | Path | Purpose |
|--------|------|---------|
| POST/GET | `/agents` · `/agents/{key}/versions/{v}` | Register / read agent definitions |
| POST | `/agents/{key}/run` | Run an agent (usually called as a step) |
| GET | `/agent-runs` · `/agent-runs/{id}` · `/agent-runs/{id}/steps` | Agent run observability |
| POST/GET | `/tools` | Tool registry management |
| POST | `/agents/{key}/evaluate` | Run eval/regression suite |

## 18.5 Approvals
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/approvals` | Create an approval request (usually engine-internal) |
| GET | `/approvals` | List (filter by role, status, SLA) — powers the approval queue |
| GET | `/approvals/{id}` | Detail + context |
| POST | `/approvals/{id}/decision` | Approve/reject/request-changes (+comment) |
| POST | `/approvals/{id}/comment` | Add comment |
| POST | `/approvals/{id}/reassign` · `/escalate` | Reassign / escalate |
| GET/POST | `/approval-policies` | Manage policies |

## 18.6 Tasks
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/task-queues` | Manage queues |
| POST | `/tasks` | Create a task |
| GET | `/tasks` | Queue/inbox view (filter by queue, assignee, status, priority, SLA) |
| GET | `/tasks/{id}` | Task detail |
| POST | `/tasks/{id}/assign` · `/claim` · `/start` | Assignment lifecycle |
| POST | `/tasks/{id}/complete` | Complete with structured result (+attachments) |
| POST | `/tasks/{id}/block` · `/cancel` · `/escalate` | State transitions |

## 18.7 Rules
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/rule-sets` · `/rule-sets/{key}/versions/{v}` | Manage versioned rule sets |
| POST | `/rule-sets/{key}/publish` | Publish (immutable) |
| POST | `/rule-sets/{key}/evaluate` | Evaluate against facts (used by steps; also test) |
| POST | `/rule-sets/{key}/simulate` | Dry-run against historical facts (impact analysis) |

## 18.8 Scheduling
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/schedules` | Create/list cron/delayed/recurring schedules |
| POST | `/schedules/{id}/pause` · `/resume` · `/run-now` | Control |

## 18.9 Observability / admin
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/metrics/workflows` · `/metrics/agents` · `/metrics/cost` | Dashboards data |
| GET | `/runs/{id}/trace` | Trace view (links to Sentry/OTel) |
| GET | `/audit` | Query automation audit (proxied to S7) |
| GET | `/health` · `/ready` | Liveness/readiness |

## 18.10 Webhooks (outbound)
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/webhook-endpoints` | Partners subscribe to automation/app events (signed, retried) |
| GET | `/webhook-deliveries` | Delivery log + replay |

## 18.11 AuthZ & rate limiting (applies to all)
- Internal calls: session token (user) or workflow/service principal; agent calls use delegated scoped tokens.
- Public calls: API key / OAuth client-credentials; per-key + per-org rate limits.
- Powerful endpoints (`/override`, `/replay?mode=effectful`, publish, policy/rule changes) require elevation + audit + separation of duties.

## 18.12 Acceptance criteria (API)
`ACCEPTANCE:`
- Every mutating endpoint is idempotent (Idempotency-Key) and Zod-validated.
- Run/agent/approval/task state is fully observable via read endpoints.
- Operator actions (override/replay/cancel) are permissioned and audited.
- Inbound webhook endpoints verify signatures and dedupe before emitting events.
- Public endpoints are versioned, documented (OpenAPI), and rate-limited.
