---
name: BorderPass Concierge
colors:
  surface: '#fff8f6'
  surface-dim: '#ebd6ce'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ec'
  surface-container: '#ffe9e2'
  surface-container-high: '#f9e4dc'
  surface-container-highest: '#f3ded7'
  on-surface: '#241915'
  on-surface-variant: '#57423a'
  inverse-surface: '#3a2e29'
  inverse-on-surface: '#ffede7'
  outline: '#8b7268'
  outline-variant: '#dec0b5'
  surface-tint: '#a33e06'
  primary: '#a33e06'
  on-primary: '#ffffff'
  primary-container: '#f47a42'
  on-primary-container: '#5f2000'
  inverse-primary: '#ffb597'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#1b6b51'
  on-tertiary: '#ffffff'
  tertiary-container: '#61ab8d'
  on-tertiary-container: '#003d2b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#ffb597'
  on-primary-fixed: '#360f00'
  on-primary-fixed-variant: '#7d2d00'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#a6f2d1'
  tertiary-fixed-dim: '#8bd6b6'
  on-tertiary-fixed: '#002116'
  on-tertiary-fixed-variant: '#00513b'
  background: '#fff8f6'
  on-background: '#241915'
  surface-variant: '#f3ded7'
typography:
  display-lg:
    fontFamily: Literata
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Literata
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Literata
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  max-width: 1280px
---

## Brand & Style
The design system is built on the philosophy of "Warm Professionalism." It bridges the gap between logistical complexity and human service, positioning itself as a premium cross-border concierge. The visual direction blends **Modern Minimalism** with **Tactile Elegance**, utilizing high-end editorial layouts and smooth, deliberate transitions.

The emotional response should be one of "effortless reliability." Users should feel the efficiency of a global logistics platform paired with the personalized care of a luxury travel desk. The aesthetic is inspired by the polish of high-end hardware interfaces and the welcoming, organic warmth of lifestyle hospitality brands.

Key visual principles:
- **Atmospheric Warmth:** Using soft sand and warm whites to avoid the sterile "tech" feel.
- **Intentional Polish:** Subtle gradients and multi-layered shadows that suggest physical quality.
- **Cultural Resonance:** Using a palette that subtly nods to vibrant heritage while maintaining a global, professional standard.

## Colors
The palette is centered on a "Warm Sunset Orange" (Primary) which serves as the energetic driver for actions and discovery. This is anchored by "Deep Navy" (Secondary) to establish institutional trust and professional authority.

**Usage Guidance:**
- **Primary (Sunset Orange):** Reserved for high-priority CTAs, progress indicators, and active states.
- **Secondary (Deep Navy):** Used for primary navigation, footers, and heavy text to ensure readability and weight.
- **Tertiary (Emerald Green):** Used for "Success" states and subtle accents that celebrate growth and Mexican heritage.
- **Surface Tones:** Use the "Warm White" for main backgrounds and "Soft Sand" for container layering to create soft, organic depth without relying on harsh greys.
- **Accent (Gold):** Used sparingly for "Premium" or "VIP" tiers, badges, and high-level service indicators.

## Typography
The typography strategy uses a "Serif-over-Sans" hierarchy to emphasize the concierge nature of the service. **Literata** provides a literary, established feel for storytelling and headers. **DM Sans** ensures high utility, readability, and a modern edge for functional UI elements and long-form bilingual content.

**Bilingual Considerations:**
- Spanish text typically runs 20-25% longer than English. All typography roles use a generous line-height (`1.5x` for body) to ensure that stacked bilingual labels remain legible and don't feel cramped.
- Avoid all-caps for long Spanish phrases; use `label-lg` only for short, 1-3 word identifiers.

## Layout & Spacing
This design system utilizes a **Fluid Grid** with wide margins to create a sense of luxury and "breathing room." 

- **Desktop:** 12-column grid with 24px gutters. Main content is often centered in a 10-column span to increase negative space on the edges.
- **Mobile:** 4-column grid with 20px margins.
- **Spacing Rhythm:** Use 24px (`md`) as the default padding for containers and cards to align with the 24px corner radius, creating a harmonious inner-and-outer relationship.
- **Vertical Rhythm:** Use larger `xl` (80px) gaps between major sections to emphasize the "unrushed" premium experience.

## Elevation & Depth
Depth is achieved through **Ambient Shadows** rather than stark borders. Shadows should be multi-layered (3-stack) to mimic natural light diffusion.

- **Level 1 (Default Cards):** 0px 4px 20px rgba(15, 23, 42, 0.05).
- **Level 2 (Hover/Active):** 0px 12px 32px rgba(15, 23, 42, 0.08).
- **Glassmorphism:** Use for floating navigation bars—Backdrop Blur (12px) with a 60% opacity "Warm White" fill and a 1px white border at 20% opacity.

The goal is to make elements feel like they are resting on a soft surface, not floating in a digital vacuum.

## Shapes
The shape language is defined by extreme **Roundedness (Pill-shaped/3xl)**. This softens the technical aspect of logistics and makes the UI feel approachable and "human-first."

- **Primary Radius:** 24px for all standard cards, modals, and primary buttons.
- **Secondary Radius:** 12px for smaller nested elements like input fields or tags.
- **Media:** Photography should always follow the 24px radius to maintain the organic, soft aesthetic.

## Components
- **Buttons:** Primary buttons use `rounded-3xl` (24px+), Sunset Orange fill, and white text. They should have a subtle 2px bottom-weighted inner shadow to provide a tactile "pressable" feel.
- **Input Fields:** Use the "Soft Sand" color as a subtle background fill instead of white. This reduces eye strain and fits the warm palette. Focus states should use a 2px Deep Navy border.
- **Concierge Cards:** Large white surfaces with 24px padding and Level 1 shadows. Headers inside cards should use Literata (headline-md).
- **Bilingual Toggles:** Pill-shaped switchers using Deep Navy for the active state and Soft Sand for the track.
- **Status Chips:** Use Tertiary (Emerald Green) for "Cleared Customs" or "Delivered" with 10% opacity backgrounds and 100% opacity text for a sophisticated look.
- **Progress Indicators:** Use a thick (8px) Sunset Orange line with rounded caps to indicate shipment travel.