# 14 · Notification Strategy

Multi-channel (Email · SMS · WhatsApp · In-app; Push in V1) via the platform Notifications service. Bilingual **EN/ES** (sent in the customer's chosen language; ES is first-class). Tone = "Warm Professionalism" — reassuring, premium, clear. Channel chosen by preference + urgency, with fallback. Transactional messages bypass quiet hours; marketing/follow-ups respect them.

> Variables in `{{braces}}`. Each template defines channel suitability. WhatsApp templates require pre-approval `⚠️ VERIFY`. Keep SMS short; email can be richer; in-app links deep into the order.

---

## 14.1 Channel strategy
| Channel | Best for | Notes |
|---------|----------|-------|
| **WhatsApp** | Primary for Juárez (high adoption), conversational + status | Template approval + opt-in `⚠️ VERIFY`; concierge lives here |
| **SMS** | Fallback, time-critical | Short; for OTP + key alerts |
| **Email** | Receipts, quotes, richer detail, records | Itemized quotes, receipts, invoices |
| **In-app** | Always (notification center) + deep links | Mirrors every event |
| **Push** (V1) | Re-engagement, real-time | Opt-in |

**Selection:** default WhatsApp + in-app for status; email for financial docs; SMS fallback if WhatsApp undelivered. Critical (OTP, payment, issue, delivery) = multi-channel.

---

## 14.2 Templates (EN / ES sample copy)

> Format per template: trigger → channels → copy. Headlines use warm, concierge phrasing.

### Account created
- **Trigger:** signup complete. **Channels:** WhatsApp, in-app, (email).
- **EN:** "Welcome to BorderPass, {{name}}! 🎉 Your trusted bridge to U.S. shopping is ready. Start your first request anytime."
- **ES:** "¡Bienvenido a BorderPass, {{name}}! 🎉 Tu puente confiable para comprar en EE. UU. está listo. Crea tu primera solicitud cuando quieras."

### Request submitted
- **Trigger:** `submitted`. **Channels:** WhatsApp, in-app.
- **EN:** "We've received your request {{order_id}}. Our team is reviewing the details — we'll have your quote soon."
- **ES:** "Recibimos tu solicitud {{order_id}}. Nuestro equipo está revisando los detalles — pronto tendrás tu cotización."

### Missing information
- **Trigger:** `missing_information`. **Channels:** WhatsApp, in-app, email.
- **EN:** "Quick note on order {{order_id}}: we need {{missing_items}} to continue. Add it here: {{link}}"
- **ES:** "Una nota sobre tu pedido {{order_id}}: necesitamos {{missing_items}} para continuar. Agrégalo aquí: {{link}}"

### Quote ready
- **Trigger:** `quote_ready`. **Channels:** email (itemized) + WhatsApp + in-app.
- **EN:** "Your BorderPass quote is ready! Item: {{item}} · Service fee: {{fee}} · Est. duties: {{duties}} · Total: {{total}}. Review & approve: {{link}} (valid until {{expiry}})."
- **ES:** "¡Tu cotización de BorderPass está lista! Artículo: {{item}} · Tarifa de servicio: {{fee}} · Impuestos est.: {{duties}} · Total: {{total}}. Revisa y aprueba: {{link}} (válida hasta {{expiry}})."

### Payment received
- **Trigger:** `paid`. **Channels:** email (receipt) + WhatsApp + in-app.
- **EN:** "Payment confirmed for order {{order_id}} — thank you, {{name}}! We're getting started. Receipt: {{link}}"
- **ES:** "Pago confirmado para el pedido {{order_id}} — ¡gracias, {{name}}! Estamos comenzando. Recibo: {{link}}"

### Package received (at El Paso Hub)
- **Trigger:** `received_el_paso`. **Channels:** WhatsApp, in-app.
- **EN:** "Good news! Your package for order {{order_id}} arrived at our El Paso Hub. Inspection is next."
- **ES:** "¡Buenas noticias! Tu paquete del pedido {{order_id}} llegó a nuestro Hub de El Paso. Sigue la inspección."

### Inspection completed
- **Trigger:** `inspection_passed`. **Channels:** WhatsApp, in-app, (email).
- **EN:** "We inspected and sealed your item ✅ Verified contents, serial confirmed. View the photos: {{link}}"
- **ES:** "Inspeccionamos y sellamos tu artículo ✅ Contenido verificado, número de serie confirmado. Mira las fotos: {{link}}"

### Border crossing started
- **Trigger:** `border_crossing`. **Channels:** WhatsApp, in-app, (push V1).
- **EN:** "Your package is crossing the border now 🌉 Track it live: {{link}} · ETA {{eta}}."
- **ES:** "Tu paquete está cruzando la frontera ahora 🌉 Síguelo en vivo: {{link}} · Llegada estimada {{eta}}."

### Customs delay
- **Trigger:** customs hold/delay (W11). **Channels:** WhatsApp, in-app.
- **EN:** "Small update on {{order_id}}: it's taking a little longer in customs ({{reason}}). New ETA: {{eta}}. We're on it — message us anytime."
- **ES:** "Una actualización sobre {{order_id}}: está tardando un poco más en la aduana ({{reason}}). Nueva llegada estimada: {{eta}}. Estamos al pendiente — escríbenos cuando quieras."

### Out for delivery
- **Trigger:** `out_for_delivery`. **Channels:** WhatsApp, SMS, in-app, (push).
- **EN:** "Your package is out for delivery 🚚 Arriving {{window}}. Driver: {{driver}}. Track: {{link}}"
- **ES:** "Tu paquete está en reparto 🚚 Llega {{window}}. Conductor: {{driver}}. Sigue: {{link}}"

### Delivered
- **Trigger:** `delivered`. **Channels:** WhatsApp, in-app, (email).
- **EN:** "Delivered! 🎉 Enjoy your purchase, {{name}}. Thank you for trusting BorderPass. Tap to reorder anytime: {{link}}"
- **ES:** "¡Entregado! 🎉 Disfruta tu compra, {{name}}. Gracias por confiar en BorderPass. Vuelve a pedir cuando quieras: {{link}}"

### Issue found
- **Trigger:** `inspection_failed` / problem. **Channels:** WhatsApp + in-app + (call).
- **EN:** "We found an issue with order {{order_id}}: {{issue}}. Don't worry — your concierge {{concierge}} will help resolve it. Reply here or tap: {{link}}"
- **ES:** "Encontramos un problema con el pedido {{order_id}}: {{issue}}. No te preocupes — tu concierge {{concierge}} te ayudará a resolverlo. Responde aquí o toca: {{link}}"

### Refund processed
- **Trigger:** `refunded`. **Channels:** email + WhatsApp + in-app.
- **EN:** "Your refund of {{amount}} for order {{order_id}} has been processed. It should appear in {{timeline}}. Questions? We're here."
- **ES:** "Tu reembolso de {{amount}} del pedido {{order_id}} fue procesado. Debería reflejarse en {{timeline}}. ¿Dudas? Aquí estamos."

### Support reply
- **Trigger:** concierge/support responds. **Channels:** WhatsApp + in-app + (push).
- **EN:** "{{concierge}} from BorderPass replied to your message about {{order_id}}: {{preview}} — open chat: {{link}}"
- **ES:** "{{concierge}} de BorderPass respondió a tu mensaje sobre {{order_id}}: {{preview}} — abre el chat: {{link}}"

---

## 14.3 Strategy rules
- **Language:** sent in the customer's `language` preference; ES never an afterthought; layouts/copy tested for ~20–25% longer Spanish.
- **Channel preference + fallback:** honor per-customer channel prefs; fall back (WhatsApp→SMS→email) on hard failure; surface an ops task if a critical message can't be delivered.
- **Frequency + quiet hours:** transactional (OTP, payment, issue, delivery) always send; non-urgent (reminders, follow-ups, marketing) respect quiet hours + frequency caps.
- **Deep links:** every notification links into the exact order/journey/quote/chat screen.
- **Delivery tracking + retry:** status tracked; retries with fallback; idempotent (no double-send).
- **Concierge continuity:** WhatsApp is both notification + 2-way concierge thread (Stitch concierge card) — replies route to the human concierge.
- **Trust tone:** especially for *Issue found* / *Customs delay* — calm, human, solution-oriented, with concierge access (critical for no-visa/low-trust personas).
- **Templates governed:** versioned, localized, approved (esp. WhatsApp `⚠️ VERIFY`); managed in Admin → Notifications.
