# BorderPass Product Specification

## 1. Product Vision & Strategy
**Tagline:** Your trusted bridge between the U.S. and Mexico.
**Mission:** To remove the friction of cross-border shopping through a premium, personal concierge experience that ensures safety, transparency, and trust.

## 2. Information Architecture
### Customer App
- **Onboarding:** Language selection (EN/ES), Phone Verification, Account Creation.
- **Home (Service Hub):** Active order status, Service selection (Buy for Me, Package Reception, Local Pickup, Business Delivery).
- **The Journey:** Signature vertical timeline of package progress.
- **Concierge:** 1:1 human support via WhatsApp, Chat, and Voice.
- **Profile:** Multi-address management (Juárez & El Paso Hub), Payment Methods, Order History, Loyalty Rewards.

### Operations (Admin)
- **Dashboard:** Real-time visibility into Hub intake, Customs queue, and Driver dispatch.
- **Inspection Center:** High-fidelity photo logging, OCR serial number capture, and AI risk scoring.

## 3. Design System (Tokens & Components)
### Palette
- **Primary:** Deep Navy (#0F172A) - Trust, Authority.
- **Accent:** Sunset Orange (#F47A42) - Warmth, Action, Energy.
- **Success:** Emerald Green (#10B981) - Safety, Completion.
- **Surface:** Warm White (#FFF8F6) & Soft Sand (#F3E8E2).

### Typography
- **Headings:** Literata (Serif) - Premium, authoritative, warm.
- **Body:** DM Sans (Sans-serif) - Clear, functional, legible at all sizes.

### Component Inventory
- **The Bridge Progress Bar:** A custom linear progress indicator that visually slides a package icon from "USA" to "Mexico" labels.
- **Journey Nodes:** Circular status indicators with secondary labels for "Verified & Sealed" or "GPS Tracked".
- **Trust Cards:** Small dismissible UI units that highlight insurance coverage or money-back protection.

## 4. Interaction & Motion Guide
- **The Border Crossing:** When a package moves from Customs to Driver Assigned, a confetti animation triggers on the Tracking screen.
- **Card Elevation:** Surfaces use soft shadows (8px blur, 5% opacity) and gently scale (1.02x) on tap to provide haptic-like visual feedback.
- **Skeleton Loaders:** Used across all map and list views to maintain perceived performance.

## 5. Roadmap
- **V1:** Core cross-border concierge, inspection logging, and Journey Tracking.
- **V2:** AI Shopping Assistant (URL extraction & tax estimation), Business Procurement module.
- **V3:** Full Marketplace integration, Subscription shopping, and U.S. store returns service.
