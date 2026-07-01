# BorderPass — Product Requirements Document & Product Architecture Blueprint

> **Status:** Draft v0.1 · **Owner:** Product (CPO / Principal Product Architect) · **Last updated:** 2026-06-29
> **App:** **BorderPass** — a premium cross-border shopping concierge. *Powered by Maralito Labs* (footer/about only).
> **Built on:** [Maralito Platform](../maralito-platform/docs) + [Maralito Automation Platform](../maralito-platform/automation).
> **Design baseline:** the approved **Stitch** design board (see [`design-reference/`](./design-reference)).
> **This is a product/PRD deliverable only** — no code, no SQL, no UI redesign, no implementation files.

---

## Purpose

This is the single source of truth that lets engineering, design, AI/agent, and operations teams build BorderPass from a clear, shared definition. It consumes three existing inputs and turns them into an implementation-ready product spec:

1. **Maralito Platform Architecture** — identity, payments, notifications, files, AI, audit, analytics (BorderPass consumes these; it does not rebuild them).
2. **Maralito Automation Platform Architecture** — the workflow engine, event model, agent orchestration, approvals, and the 12 BorderPass workflows already modeled there.
3. **BorderPass UI/UX (Stitch design board)** — the approved screens, brand, navigation, and customer journey. Treated as the **design baseline**; not redesigned here.

## How the Stitch design baseline is used

The Stitch board is **authoritative for design**. This PRD references it when defining journeys, IA, and screen requirements, and does **not** alter it except where a documented product/usability reason exists (those are flagged as **Open Questions** in [20 · Closeout](./docs/20-closeout.md)). Screens referenced: `welcome_to_borderpass`, `borderpass_home_1/2`, `new_request_flow`, `border_journey_tracker_1/2`, `inspection_details`, `package_inspection_details`, plus brand assets and `borderpass_concierge/DESIGN.md`.

### Brand snapshot (from Stitch `DESIGN.md` + product spec)

| Token | Value | Use |
|-------|-------|-----|
| Design philosophy | **"Warm Professionalism"** — luxury concierge meets global logistics | Tone of every screen + message |
| Primary (CTA) | **Sunset Orange** `#a33e06` / `#f47a42` | High-priority CTAs, progress, active states |
| Secondary | **Deep Navy** `#565e74` / `#0F172A` | Navigation, footers, heavy text, institutional trust |
| Success | **Emerald Green** `#1b6b51` / `#10B981` | "Cleared Customs", "Delivered", verified states |
| Surfaces | **Warm White** `#fff8f6` / **Soft Sand** `#f3ded7` | Backgrounds + container layering |
| Headings | **Literata** (serif) | Premium, editorial, "concierge" voice |
| Body | **DM Sans** (sans) | Functional, legible, bilingual long-form |
| Shape | Extreme roundedness — 24px cards/buttons, 12px inputs | Approachable, human-first |
| Language | **Bilingual EN/ES**, equal status; ES runs 20–25% longer | All copy + layouts |
| Signature UI | "The Bridge" progress bar; vertical Border Journey timeline; Trust Cards; Concierge card | Core to the experience |

> Naming rule applied throughout: the product is **"BorderPass."** "Powered by Maralito Labs" appears only in footer/about. Internal platform/automation services keep their Maralito names in engineering-facing docs.

## The 20 deliverables

| # | Deliverable | Doc |
|---|-------------|-----|
| 1 | Executive Summary | [01](./docs/01-executive-summary.md) |
| 2 | Product Vision | [02](./docs/02-product-vision.md) |
| 3 | User Personas | [03](./docs/03-user-personas.md) |
| 4 | Core User Journeys | [04](./docs/04-core-user-journeys.md) |
| 5 | Information Architecture | [05](./docs/05-information-architecture.md) |
| 6 | Feature Matrix | [06](./docs/06-feature-matrix.md) |
| 7 | MVP Scope | [07](./docs/07-mvp-scope.md) |
| 8 | Business Rules | [08](./docs/08-business-rules.md) |
| 9 | Order State Machine | [09](./docs/09-order-state-machine.md) |
| 10 | Border Journey Model | [10](./docs/10-border-journey-model.md) |
| 11 | Roles & Permissions | [11](./docs/11-roles-and-permissions.md) |
| 12 | AI Agent Product Requirements | [12](./docs/12-ai-agent-requirements.md) |
| 13 | Automation Workflows | [13](./docs/13-automation-workflows.md) |
| 14 | Notification Strategy | [14](./docs/14-notification-strategy.md) |
| 15 | Data Requirements | [15](./docs/15-data-requirements.md) |
| 16 | Admin & Operations Requirements | [16](./docs/16-admin-ops-requirements.md) |
| 17 | Metrics & KPIs | [17](./docs/17-metrics-kpis.md) |
| 18 | Edge Cases & Failure Modes | [18](./docs/18-edge-cases-failure-modes.md) |
| 19 | MVP Roadmap | [19](./docs/19-mvp-roadmap.md) |
| 20 | Closeout: Open Questions, Assumptions, Risks, Next Doc | [20](./docs/20-closeout.md) |

## Conventions
- **MVP / V1 / V2 / Future** = release priority. **L/M/H** = complexity.
- **`HUMAN-APPROVAL`** marks a decision an AI agent may recommend but a human must approve (compliance/financial/risky), per the automation platform's human-in-the-loop rule.
- **`⚠️ VERIFY`** = a legal/operational/third-party assumption to confirm (esp. **customs/import compliance**, which needs licensed counsel before launch).
- Status names use the canonical order state machine in [09](./docs/09-order-state-machine.md).

## Changelog
| Version | Date | Author | Change |
|---------|------|--------|--------|
| v0.1 | 2026-06-29 | Product | Initial PRD across all 20 deliverables, grounded in the Stitch baseline |
