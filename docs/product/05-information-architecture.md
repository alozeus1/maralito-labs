# 05 · Information Architecture

The full app structure across **Customer app**, **Admin platform**, and **Operations**, grounded in the Stitch screens. Bottom nav on the customer app (from Stitch home) = **Home · Orders · Messages · Support · Profile**. Bilingual EN/ES throughout.

---

## 5.1 Customer app

```
BorderPass (Customer)
├─ Welcome                         (Stitch: welcome_to_borderpass) — value prop, language EN/ES, get started
├─ Onboarding                      — language select, phone verify (OTP), account create, optional address
├─ Login / Signup                  — phone-based auth (platform Identity), returning-user login
├─ Home  [nav]                     (Stitch: borderpass_home_1/2) — "Hola [Name]", El Paso→Bridge→Juárez header,
│                                     Active Delivery card (order + In Transit chip + Track Details),
│                                     Our Services: Shop from USA · Receive My Packages · Deliver to Juárez · Business Orders
├─ New Request                     (Stitch: new_request_flow) — 3 steps:
│   ├─ 1. Choose Service           (Buy for Me · Package Reception · Local Pickup · Business Delivery)
│   ├─ 2. Product Details          (URL, qty, variant, value, notes, optional photos)
│   ├─ 3. Border Information       (purpose, declared value, RFC if business, receipt upload)
│   └─ Request Summary             (service fee, est. item value, est. import duties [AI], est. total, est. delivery)
├─ Orders  [nav]                   — list of orders w/ status chips, search/filter, reorder entry
│   └─ Order Details               — summary, items, quote, payment, documents, status timeline, actions
│       ├─ Border Journey          (Stitch: border_journey_tracker_1/2) — vertical timeline, ETA, tracking id,
│       │                             current location, stage cards, "View Photos", concierge card
│       ├─ Inspection Details      (Stitch: inspection_details / package_inspection_details) — photos,
│       │                             verified contents, serial match, seal number, inspector, trust chips
│       └─ Quote Review            — itemized quote, accept/decline, pay
├─ Payments                        — checkout (Stripe), pay duties ("Approve & Pay Duties"), payment status
├─ Concierge Chat (Messages) [nav] — 1:1 human support: in-app chat, WhatsApp, (voice future); concierge profile
├─ Notifications                   — in-app notification center (status updates, quotes, issues)
├─ Profile  [nav]                  — name, language, loyalty/rewards (future), order history
│   ├─ Addresses                   — Juárez delivery address(es) + BorderPass El Paso Hub address
│   ├─ Payment Methods             — saved cards (Stripe), default method
│   └─ Receipts / Invoices         — uploaded receipts + BorderPass-issued receipts/invoices (RFC)
├─ Help Center                     — FAQ, how it works, prohibited items, fees/duties explained (EN/ES)
└─ Settings                        — language, notification preferences (channels/quiet hours), account, legal/ToS,
                                      "About / Powered by Maralito Labs" (footer/about only)
```

**Navigation model:** bottom tab bar (Home/Orders/Messages/Support/Profile) + contextual deep links from notifications. New Request is a prominent CTA from Home and Orders. Support is always one tap away (trust principle for Rosa/no-visa persona).

**Support [nav]:** maps to Concierge/Help — a combined entry to Help Center + live concierge. (Stitch bottom nav lists "Support" and "Messages"; treat **Messages = concierge chat thread**, **Support = help hub + start a conversation**. See Open Questions in [20](./20-closeout.md).)

---

## 5.2 Admin platform

```
BorderPass Admin (web; built on Maralito Platform admin + Automation dashboard)
├─ Dashboard                       — real-time ops overview: intake queue, customs queue, dispatch, alerts, KPIs
├─ Orders                          — all orders, filters (status/service/risk/date), bulk ops, detail view
├─ Customers                       — customer profiles, history, KYC/RFC, risk flags, lifetime value
├─ Quotes                          — pending/approved quotes, pricing overrides (HUMAN-APPROVAL), expirations
├─ Payments                        — payments, receipts, reconciliation, disputes (Stripe)
├─ Refunds                         — refund requests, eligibility, approvals (HUMAN-APPROVAL), ledger
├─ Risk Reviews                    — compliance/risk queue: AI risk band + rationale, approve/reject/hold
├─ Inspections                     — inspection queue + records: photos, serial/seal, checklist, AI flags
├─ Deliveries                      — delivery tasks, routes/zones, proof of delivery, failures
├─ Drivers / Couriers              — driver roster, availability, assignments, performance
├─ Concierge Workspace             — unified customer conversations (chat/WhatsApp), order context, AI draft replies
├─ Support Tickets                 — ticket queue, categories, SLA, escalation
├─ Notifications                   — template management, delivery logs, manual sends
├─ Analytics                       — product/business/ops/AI metrics + dashboards (17)
├─ Audit Logs                      — immutable action history (users/admins/agents) — view/export
└─ Settings                        — roles/permissions, business rules config, feature flags, hub/zone config
```

---

## 5.3 Operations (El Paso Hub + last mile)

```
BorderPass Operations
├─ El Paso Hub Workflow            — master hub view: inbound expected, on-hand, staged for crossing
│   └─ Package Receiving           — scan/register inbound packages, match to order/customer, capture weight/dims/photos
├─ Inspection Queue                — packages pending inspection → inspector task (checklist, photos, serial OCR, seal)
├─ Driver Dispatch                 — assign crossings + last-mile deliveries, zones, schedules
├─ Border Crossing Tracking        — documentation status, crossing/customs state, holds, current location
└─ Delivery Confirmation           — proof capture, completion, failed-attempt handling
```

**Operational spine:** Receive (Hub) → Inspect → Document → Cross → Customs → Arrive Juárez → Deliver → Confirm — mirrors the Border Journey (10) and the automation workflows (13). Field roles (inspector, driver) use focused, mobile-friendly task views (Operations dashboards in [16](./16-admin-ops-requirements.md)).

---

## 5.4 IA principles
- **One order, one journey:** every order has a single canonical status (09) rendered to customers as the Border Journey (10) and to staff as queues.
- **Trust surfaced, complexity hidden:** customers see proof + clear next steps; operational complexity lives in Admin/Ops.
- **Bilingual parity:** every customer-facing node exists equally in EN/ES; layouts allow for ~20–25% longer Spanish.
- **Reuse platform surfaces:** Admin = Maralito Platform admin + Automation dashboard, themed for BorderPass; not a separate build.
- **Support omnipresent:** concierge/help reachable from anywhere (critical for low-trust/no-visa personas).

## 5.5 Screen → status → journey map (selected)
| Customer screen | Shows statuses | Border Journey stage |
|-----------------|----------------|----------------------|
| Home — Active Delivery | any active | current stage summary |
| Quote Review | quote_ready→awaiting_payment | Quote ready |
| Border Journey | paid→…→delivered | all stages |
| Inspection Details | inspection_passed/failed | Package inspection |
| Payments | awaiting_payment / duties | Payment received |
