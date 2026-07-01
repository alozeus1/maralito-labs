# 06 · Feature Matrix

Columns: **Feature · Description · User role · Priority (MVP/V1/V2/Future) · Complexity (L/M/H) · Dependencies · Automation opportunity · Human approval · Data required.** Covers customer, admin, operations, AI, automation, compliance, payment, notification features. `HUMAN-APPROVAL` items follow the platform human-in-the-loop rule.

> Priority legend: **MVP** = launch-critical · **V1** = fast-follow (≤60 days) · **V2** = later · **Future** = vision. Dependencies cite platform/automation services + other features.

---

## Customer features
| Feature | Description | Role | Priority | Cx | Dependencies | Automation | Human approval | Data |
|---------|-------------|------|----------|----|--------------|-----------|----------------|------|
| Phone auth + onboarding | EN/ES, OTP signup/login | Customer | MVP | M | Platform Identity, Notifications | Auto OTP | No | Phone, name, language |
| Home service hub | "Hola"+services+active order | Customer | MVP | M | Orders, Journey | Auto status | No | Order summary |
| New Request (3-step) | Buy-for-me/reception/pickup/business | Customer | MVP | H | Intake workflow, Files | Intake Agent | Risk cases | Item, border info, receipt |
| Product URL submission | Paste URL + details | Customer | MVP | M | Shopping Agent | Price resolve | No | URL, attributes |
| Receipt/invoice upload | Upload proof | Customer | MVP | L | Files (S5) | OCR (V1) | No | Receipt file |
| Border/import info form | Purpose, value, RFC | Customer | MVP | M | Compliance rules | Validate | No | Declared value, RFC |
| Transparent quote review | Itemized + duties + accept | Customer | MVP | M | Quote Agent | Quote draft | Non-standard pricing | Quote breakdown |
| Stripe payment | Secure pay + receipt | Customer | MVP | M | Payments (S3) | Auto confirm | Disputes | Payment ref |
| Pay duties | "Approve & Pay Duties" | Customer | MVP→V1 | M | Payments, Finance Agent | Auto | No | Duty amount |
| Order tracking / Border Journey | Vertical timeline + ETA | Customer | MVP | H | Status engine, Journey Agent | ETA + narration | No | Stage timestamps |
| Inspection photo viewing | Photos, serial/seal, contents | Customer | MVP | M | Files, Inspection | — | No | Inspection record |
| Concierge chat (WhatsApp/in-app) | 1:1 human support | Customer | MVP | M | Notifications, Support Agent | AI draft | Sensitive replies | Messages |
| Notifications center | In-app updates | Customer | MVP | L | Notifications | Auto | No | Notifications |
| Addresses (Juárez + Hub) | Manage addresses | Customer | MVP | L | Profile (S2) | — | No | Addresses |
| Payment methods | Saved cards | Customer | V1 | L | Payments | — | No | Card refs |
| Receipts/invoices (RFC) | BorderPass-issued docs | Customer | V1 | M | Finance, Files | Auto-gen | No | Invoice, RFC |
| Help center (EN/ES) | FAQ, fees, prohibited | Customer | MVP | L | Localization | — | No | Content |
| Reorder | Re-buy past order | Customer | V1 | M | Order history | Re-validate | Re-flagged only | Source order |
| Loyalty / VIP | Rewards, premium tier | Customer | Future | M | Billing | — | No | Tier, points |
| Local pickup service | Pickup from store/person | Customer | V2 | M | Ops, tasks | Coordinate | Risk | Pickup details |
| Settings + notif prefs | Channels, quiet hours, language | Customer | MVP | L | Notifications | — | No | Preferences |

## Admin features
| Feature | Description | Role | Priority | Cx | Dependencies | Automation | Human approval | Data |
|---------|-------------|------|----------|----|--------------|-----------|----------------|------|
| Orders dashboard | All orders + filters + detail | Ops/Admin | MVP | M | Automation dashboard | Live status | — | Orders |
| Manual review queue | Approve/reject/hold | Compliance/Ops | MVP | M | Risk Agent | AI band+rationale | **Yes** | Risk reviews |
| Quote management | Review/override quotes | Finance/Ops | MVP | M | Quote Agent | Draft | **Override** | Quotes |
| Payments + reconciliation | Track/settle/disputes | Finance | MVP | M | Payments | Auto-reconcile | Disputes | Payments |
| Refunds console | Eligibility + process | Finance | MVP→V1 | M | Refund workflow | AI eligibility | **Yes (threshold)** | Refunds, ledger |
| Customers view | Profiles, history, flags | Support/Admin | MVP | M | Profile, Audit | — | — | Customers |
| Concierge workspace | Unified convos + context | Concierge | MVP | M | Notifications, Support Agent | AI draft replies | Sensitive | Conversations |
| Support tickets | Queue, SLA, escalation | Support | V1 | M | Support workflow | Triage Agent | Specialist | Tickets |
| Notification templates | Manage templates + logs | Admin | V1 | M | Notifications | — | — | Templates |
| Analytics dashboards | KPIs (17) | Admin/Leadership | V1 | M | Analytics (S8) | Auto | — | Metrics |
| Audit log viewer | Immutable history + export | Compliance/Admin | MVP | L | Audit (S7) | Auto-capture | — | Audit events |
| Business rules config | Categories, thresholds | Compliance/Admin | V1 | M | Rules engine | — | **Changes** | Rules |
| Roles & permissions admin | Manage staff roles | Super admin | MVP | M | Identity RBAC | — | — | Roles |

## Operations features
| Feature | Description | Role | Priority | Cx | Dependencies | Automation | Human approval | Data |
|---------|-------------|------|----------|----|--------------|-----------|----------------|------|
| Package receiving | Scan/register/match inbound | Hub staff/Ops | MVP | M | Package workflow | Match Agent | Unmatched | Package |
| Inspection checklist | Structured inspection | Inspector | MVP | M | Inspection workflow | Assist Agent | **Fail/discrepancy** | Inspection |
| Inspection photo + serial/seal | Capture proof, OCR serial | Inspector | MVP | M | Files, OCR | OCR match | — | Photos, serial, seal |
| Border documentation | Assemble customs docs | Ops/Compliance | MVP→V1 | H | Journey Agent, Files | Draft docs | **Yes** | Documents |
| Crossing/customs tracking | State + holds + location | Ops | MVP | M | Journey workflow | Status updates | Holds | Crossing state |
| Driver dispatch | Assign crossings/deliveries | Ops manager | MVP→V1 | M | Tasks, zones | Auto-suggest | — | Assignments |
| Delivery confirmation | Proof of delivery | Driver | MVP | L | Delivery workflow | Auto-complete | — | PoD |
| Hub inventory view | On-hand / staged | Ops | V1 | M | Packages | — | — | Inventory |
| Freight/pallet reception | Business bulk intake | Hub staff | V2 | M | Business flow | — | — | Freight |

## AI / automation / compliance / payment / notification features
| Feature | Description | Role | Priority | Cx | Dependencies | Automation | Human approval | Data |
|---------|-------------|------|----------|----|--------------|-----------|----------------|------|
| Intake Agent | Validate/route requests | AI | MVP | M | Automation, AI gateway | Core | — | Order data |
| Risk & Compliance Agent | Screen + risk band | AI | MVP | H | Rules, AI | Recommend | **Yes (risky)** | Order, customer |
| Quote Agent + duty estimate | Itemized quote + duties | AI | MVP→V1 | H | Pricing rules, AI | Recommend | **Non-standard** | Item, route, value |
| Shopping Agent | Resolve URL price/availability | AI | V1 | M | External APIs, AI | Recommend | Purchase | Product URL |
| Inspection Assistant Agent | Photo/serial analysis | AI | V1 | M | Files, vision, AI | Recommend | **Fail** | Photos, declared |
| Border Journey Agent | ETA + narration + delays | AI | V1 | M | Status, AI | Auto narrate | — | Stage data |
| Support Agent | Triage + draft replies | AI | V1 | M | Tickets, AI | Recommend | Sensitive | Messages |
| Finance Agent | Reconcile, refund eligibility | AI | V1 | M | Payments, AI | Recommend | **Refund threshold** | Payments |
| Operations Coordinator Agent | Schedule crossings/deliveries | AI | V1 | M | Tasks, AI | Recommend | — | Ops state |
| Manager Agent | Oversight, anomaly, summaries | AI | V2 | M | All, AI | Recommend | — | Aggregate |
| Risk review workflow | Automated routing + gate | Automation | MVP | M | Automation | Core | **Yes** | Risk |
| Quote → pay → fulfill chain | Durable order workflow | Automation | MVP | H | Automation | Core | Where flagged | Order |
| Compliance: prohibited screening | Category checks | Compliance | MVP | M | Rules | Auto-flag | **Yes** | Categories |
| RFC/tax handling | Capture + invoice | Compliance/Finance | V1 | M | Profile, Finance | Auto | — | RFC |
| Stripe payments/refunds | Pay/refund + ledger | Payment | MVP | M | Payments (S3) | Auto | Refund threshold | Payments |
| Multi-channel notifications | Email/SMS/WhatsApp/in-app/push | Notification | MVP→V1 | M | Notifications (S4) | Auto | — | Templates, prefs |
| Audit logging | Immutable trail | Compliance | MVP | L | Audit (S7) | Auto | — | Audit events |

## Cross-cutting prioritization summary
- **MVP critical path:** auth → new request → receipt/border info → quote (manual-assisted) → Stripe pay → order tracking/Border Journey → Hub receive → inspection + photos → delivery confirm → concierge → audit. (Exact list in [07](./07-mvp-scope.md).)
- **Automate-first, human-gate-always** for: risk/compliance decisions, non-standard quotes, refunds, inspection failures, border documentation.
- **Highest complexity (H):** New Request flow, Border Journey, Risk Agent, Quote+duty estimation, Border documentation — sequence carefully.
