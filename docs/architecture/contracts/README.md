# BorderPass — Backend Contract Package

> **Status:** ACTIVE (architecture/contract-level) · **Last updated:** 2026-06-29
> **Start here → [`00-README.md`](./00-README.md)**

The Technical Architecture Document is signed off, so these implementation contracts are now produced. They are **architecture/contract-level only** — no application code, no Drizzle/SQL DDL, no Zod runtime code, no full migrations (those code-level artifacts are still generated downstream, from these contracts, after the Compliance & Customs Operating Model lands).

## Contents

| File | Covers |
|------|--------|
| [`00-README.md`](./00-README.md) | Overview, ER map, global conventions, traceability, open items |
| [`01-data-model.md`](./01-data-model.md) | All 30 entities — fields, required/optional/sensitive, retention, indexing, RLS |
| [`02-api-contracts.md`](./02-api-contracts.md) | Customer/Admin/Automation APIs + server actions, validation, errors |
| [`03-event-contracts.md`](./03-event-contracts.md) | Event envelope + catalog, webhooks, workflow-run + agent-run contracts |
| [`04-state-machines.md`](./04-state-machines.md) | Order/Payment/Inspection/Delivery machines + notification matrix |
| [`05-access-control-and-data-requirements.md`](./05-access-control-and-data-requirements.md) | RBAC, RLS, audit-log contract, admin/customer/reporting data |

This package maps to all 30 requested deliverables; each file footer lists which it satisfies.
