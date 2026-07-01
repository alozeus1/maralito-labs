# 20 · Closeout — Open Questions, Assumptions, Risks, Next Document

Deliverable 20 asks that the whole PRD be formatted as a professional product-architecture document with clear headings, tables, text-form flow diagrams, prioritized MVP scope, implementation-ready decisions, and an explicit list of open questions, assumptions, risks, and the next recommended document. The full document satisfies the format requirements across files 01–19; this file captures the **meta layer**.

---

## 20.1 Implementation-ready product decisions (locked in this PRD)
1. **App = "BorderPass"; "Powered by Maralito Labs" only in footer/about.**
2. **Design baseline = Stitch board** ("Warm Professionalism", Literata + DM Sans, Sunset Orange/Deep Navy/Emerald, Warm White/Soft Sand, 24px rounded, bilingual EN/ES). Not redesigned here.
3. **Four services** (Stitch): Buy-for-Me, Package Reception, Local Pickup, Business Delivery. **MVP = Buy-for-Me + Package Reception**; Pickup/Business assisted in MVP.
4. **24-status order state machine** (09) → **12-stage Border Journey** (10) is the canonical model.
5. **Human-in-the-loop is mandatory** for risk/compliance/financial/irreversible decisions; agents recommend only.
6. **Reuse Maralito Platform + Automation** for all infrastructure; BorderPass owns only its domain.
7. **MVP = polished automated experience over mostly manual ops**, every order human-reviewed.
8. **WhatsApp-first bilingual notifications** + human concierge as the trust spine.

## 20.2 Open questions (need a decision-maker)
| # | Question | Owner | Default if unresolved |
|---|----------|-------|------------------------|
| OQ1 | **Brand color hierarchy conflict:** Stitch `DESIGN.md` sets Primary = Sunset Orange (CTAs) + Deep Navy secondary; the product spec calls Primary = Deep Navy + Accent = Orange. Which governs? | Design lead | Follow `DESIGN.md` + rendered screens (Orange = primary CTA, Navy = structure) |
| OQ2 | **Nav semantics:** Stitch bottom nav shows both "Messages" and "Support". Are these one concierge thread or distinct (chat vs. help hub)? | Product/Design | Messages = concierge chat; Support = help hub + start convo |
| OQ3 | **Duty calculation:** AI-estimated vs. flat-fee vs. broker-provided? Accuracy + legal exposure. | Compliance/Finance | MVP: human-confirmed estimate; flag as "estimated" |
| OQ4 | **Who is importer of record / customs broker model?** BorderPass vs. partner vs. customer. | Legal/Compliance | `⚠️ VERIFY` with counsel before live orders |
| OQ5 | **Service fee model:** flat $15 (Stitch) vs. tiered/percentage by value/category? | Product/Finance | MVP flat + value-based surcharge for high-value |
| OQ6 | **Local Pickup scope** for MVP (assisted vs. excluded)? | Product/Ops | Assisted, limited |
| OQ7 | **KYC threshold + provider** for high-value/business. | Compliance | Trigger at high-value tier; provider TBD |
| OQ8 | **Insurance/money-back terms** (Stitch trust cards) — underwriter, coverage, claims. | Finance/Legal | Define before advertising the promise |
| OQ9 | **Hub address provisioning** — per-customer suite vs. shared + reference id. | Ops | Shared Hub + per-order reference |
| OQ10 | **Quote validity window** + price-change policy. | Finance | 48–72h; re-quote on material change |

## 20.3 Assumptions
- Maralito Platform + Automation MVPs land in time to support BorderPass MVP (auth, payments, notifications, files, audit, workflow engine).
- An **El Paso Hub** with receiving + inspection capability and **last-mile delivery** into Juárez are operationally available.
- **WhatsApp Business** is approved and is the dominant channel for the audience (`⚠️ VERIFY` adoption + template approval).
- A **compliant path to cross goods** exists (broker/partner or in-house) — the central legal assumption.
- Target customers will **pay a premium for trust + convenience** over informal options (validate in pilot).
- Stripe supports the payment + refund + (future) Connect needs for the corridor/currencies (`⚠️ VERIFY`).
- Initial volume is **pilot-scale**, allowing manual ops with automation assistance.

## 20.4 Risks (product-level; engineering/security risks live in the platform/automation blueprints)
| # | Risk | Sev | Mitigation |
|---|------|-----|------------|
| PR1 | **Customs/compliance misstep** (prohibited goods cross, wrong duties, legal exposure) | High | Licensed counsel; human compliance gate on every order; conservative category list; `⚠️ VERIFY` before live |
| PR2 | **Trust failure** (lost/damaged/wrong item, opaque delay) erodes the whole value prop | High | Inspection proof, proactive comms, concierge, money-back; never fail silently (18) |
| PR3 | **Duty-estimate inaccuracy** angers customers / loses money | High | Human-confirmed estimates; label "estimated"; reconcile actuals; refine rules |
| PR4 | **Operational capacity** can't meet demand (Hub/drivers) | Med | Pilot-scale launch; waitlist; capacity planning; SLA monitoring |
| PR5 | **Unit economics** (CAC > CLV; fees don't cover ops+AI+duties) | Med | Track AOV/fee/margin from day one; tune pricing (OQ5) |
| PR6 | **AI errors on risky calls** | Med | Human-in-the-loop mandatory; evals + low-confidence escalation; override-rate monitoring |
| PR7 | **Fraud** at real volume (stolen cards, false claims) | Med | Stripe Radar + fraud rules + KYC + holds + human review (18.15) |
| PR8 | **Regulatory change** in cross-border trade/tariffs | Med | Monitor; rules engine makes thresholds/categories tunable; counsel on retainer |
| PR9 | **Brand/design inconsistency** (OQ1) slows build | Low | Resolve OQ1 with design lead before UI build |
| PR10 | **Over-scoping MVP** (building V1/automation depth too early) | Med | Strict MVP gate (07); defer list; ship ops-assisted |

## 20.5 What this PRD deliberately did NOT do
- No code, no SQL schema, no UI components, no UI redesign (per instructions).
- Did not re-specify platform/automation internals (referenced their blueprints instead).
- Did not finalize legal/compliance specifics — flagged for counsel.

## 20.6 Next recommended documents (in priority order)
1. **Compliance & Customs Operating Model** (with counsel) — importer-of-record, broker/partner, duty methodology, prohibited/accepted master list, RFC/invoicing/tax, abandoned-goods handling. **Gating for launch.**
2. **BorderPass Design Spec / Screen-by-Screen UX** — extend the Stitch baseline into full flows, states (loading/empty/error), and bilingual copy deck (resolve OQ1/OQ2).
3. **Engineering Technical Design** — how BorderPass consumes the platform SDK + automation workflows; the 24-status engine + 15 workflows implemented on the engine; data schema (Drizzle) from the entity model (15).
4. **Operations Playbook & Hub SOPs** — receiving, inspection, crossing, dispatch, delivery, exception runbooks; staffing + SLAs.
5. **AI Agent Spec & Eval Plan** — per-agent prompts, tools, guardrails, eval datasets, autonomy-promotion criteria (from 12).
6. **Pilot Go-to-Market Plan** — target segments, acquisition, trust content, pricing test, success metrics (from 17/19).
7. **Service Pricing & Unit-Economics Model** — fee structure, duty handling, margin, CLV/CAC (resolve OQ5).

---

## 20.7 Document completeness check
All 20 deliverables are covered: 01 Exec Summary · 02 Vision · 03 Personas (7) · 04 Journeys (12) · 05 IA · 06 Feature Matrix · 07 MVP Scope · 08 Business Rules · 09 State Machine (24) · 10 Border Journey (12) · 11 Roles (9) · 12 AI Agents (10) · 13 Automation Workflows (15) · 14 Notifications (EN/ES) · 15 Data (20 entities) · 16 Admin/Ops (8) · 17 KPIs · 18 Edge Cases (15) · 19 Roadmap · 20 Closeout.

**Status:** Ready for review by Product, Design, Engineering, AI, Operations, and Compliance leads. The single highest-priority follow-up is the **Compliance & Customs Operating Model** — it gates real cross-border orders.
