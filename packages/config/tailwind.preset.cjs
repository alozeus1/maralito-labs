/**
 * Shared Tailwind preset — BorderPass design tokens (Stitch / DESIGN.md authoritative).
 * Phase 0: token scaffold only. Full token set wired in Phase 2 (design system).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Stitch tokens (DESIGN.md) — Phase 2 completes the full Material-style set.
        primary: '#a33e06',
        'primary-container': '#f47a42',
        secondary: '#565e74',
        tertiary: '#1b6b51', // success
        background: '#fff8f6',
        surface: '#fff8f6',
        'on-surface': '#241915',
        'on-surface-variant': '#57423a',
        error: '#ba1a1a',
        outline: '#8b7268',
      },
      borderRadius: { sm: '0.5rem', DEFAULT: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
      fontFamily: {
        heading: ['Literata', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
};
