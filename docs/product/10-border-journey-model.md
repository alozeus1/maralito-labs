# 10 · Border Journey Model

The signature customer-facing experience (Stitch `border_journey_tracker_1/2`): a **vertical timeline** that narrates the package from request to doorstep with trust at every node. 12 stages. Each maps to internal statuses (09) and renders bilingual EN/ES with a trust indicator. Visual language from the Stitch design (orange progress, emerald "verified/cleared" chips, "The Bridge" progress bar, concierge card).

> Tone: warm, reassuring, premium ("Warm Professionalism"). Spanish copy is first-class (allow ~20–25% longer). Notifications fire on stage entry (14).

---

## 10.1 Stage table

| # | Stage | Customer message (EN) | Customer message (ES) | Internal status (09) | Icon | Trust indicator | Notification text (EN) | Possible delay reason |
|---|-------|------------------------|------------------------|----------------------|------|-----------------|------------------------|------------------------|
| 1 | **Request received** | "We've got your request and are reviewing the details." | "Recibimos tu solicitud y estamos revisando los detalles." | submitted / under_review | 📝 clipboard | "Reviewed by our team" | "Your BorderPass request was received." | Missing info; review backlog |
| 2 | **Quote ready** | "Your transparent quote is ready to review." | "Tu cotización transparente está lista." | quote_ready | 🧾 receipt | "No hidden fees" | "Your quote is ready — review & approve." | Awaiting price/duty confirm |
| 3 | **Payment received** | "Payment confirmed. We're getting started!" | "Pago confirmado. ¡Comenzamos!" | paid | 💳 card / ✅ | "Secure payment • protected" | "Payment received. Thank you!" | Payment retry/failure |
| 4 | **Purchased in the U.S.** | "We purchased your item from the store." | "Compramos tu artículo en la tienda." | purchasing / purchased | 🛍️ bag | "Purchase confirmed" | "We've purchased your item." | Out of stock; price change |
| 5 | **Received at El Paso Hub** | "Your package arrived at our El Paso Hub." | "Tu paquete llegó a nuestro Hub de El Paso." | received_el_paso | 🏢 hub | "Arrived & logged" | "Your package reached our El Paso Hub." | Carrier delay; not yet arrived |
| 6 | **Package inspection** | "We verified and repacked your item — see the photos." | "Verificamos y reempacamos tu artículo — mira las fotos." | inspection_pending/passed | 🔍 magnifier | "Verified & Sealed" (emerald) | "Inspection complete — view photos." | Discrepancy; receipt missing |
| 7 | **Border documents ready** | "Customs documents are prepared for crossing." | "Los documentos de aduana están listos para cruzar." | border_documentation_ready | 📄 docs | "Compliance approved" | "Your border documents are ready." | Doc/compliance review |
| 8 | **Crossing the border** | "Your package is crossing the international bridge." | "Tu paquete está cruzando el puente internacional." | border_crossing | 🌉 bridge | "GPS tracked" | "Your package started its border crossing." | Bridge wait times |
| 9 | **Customs processing** | "Going through customs — almost there." | "Pasando por la aduana — casi listo." | customs_processing | 🛂 customs | "Cleared customs" (on exit) | "Your package is in customs processing." | **Customs hold/inspection** |
| 10 | **Arrived in Juárez** | "Your package arrived in Ciudad Juárez!" | "¡Tu paquete llegó a Ciudad Juárez!" | arrived_juarez | 📍 pin | "In your city" | "Your package arrived in Juárez." | Local logistics |
| 11 | **Out for delivery** | "Your package is on the way to you." | "Tu paquete va en camino a ti." | out_for_delivery | 🚚 truck | "Driver assigned • GPS tracked" | "Out for delivery — arriving soon." | Address issue; recipient absent |
| 12 | **Delivered** | "Delivered! Enjoy — and thank you for trusting BorderPass." | "¡Entregado! Disfrútalo — gracias por confiar en BorderPass." | delivered | 🎉 home/check | "Delivered • proof captured" | "Delivered! Thank you." | (Disputed delivery) |

---

## 10.2 Visual & interaction notes (from Stitch)
- **The Bridge progress bar:** linear indicator sliding a package icon from "El Paso / USA" → "Ciudad Juárez / MX" labels (home header + journey top).
- **Vertical timeline:** completed stages = filled orange node + timestamp; current = highlighted card ("In Progress" chip); future = muted. Stage 6 shows **"View Photos"** thumbnails linking to Inspection Details.
- **Trust chips:** emerald for "Verified & Sealed", "Cleared Customs", "Delivered"; navy for informational.
- **Concierge card pinned** at bottom of the journey: photo + name ("Maria G."), rating, languages, **WhatsApp + Live Chat** buttons.
- **ETA banner:** "Arriving Tomorrow" + "Expected delivery by 5:00 PM CST" + tracking id (e.g., BP-8492-MX) + current location ("Approaching Zaragoza Port of Entry").
- **Delivered celebration:** confetti micro-animation on entering stage 12 (product-spec motion guide).

## 10.3 Delay handling (trust under friction)
- **IF** a stage exceeds its expected window (esp. **Customs processing**) **THEN** show a calm explanatory message + updated ETA + concierge access, and fire a *Customs delay* notification with the reason — never leave a silent gap. (Border Journey Agent generates the explanation; ops confirm.)
- Every stage always answers: **where is it, what's happening, what's next, and who to ask** — the core trust contract for the no-visa/low-trust personas.

## 10.4 Mapping summary
- 12 customer stages ⟷ 24 internal statuses (09); multiple internal statuses can roll up to one customer stage (e.g., received/inspection_pending both read as "at the Hub / inspecting").
- Stages drive: notifications (14), trust indicators, and the home "Active Delivery" summary card.
