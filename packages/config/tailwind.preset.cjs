/**
 * Shared Tailwind preset — BorderPass design tokens (Stitch / DESIGN.md authoritative).
 * Full Material-style token set + spacing/radius/type roles used by the Stitch product UI.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces
        background: '#fff8f6',
        surface: '#fff8f6',
        'surface-dim': '#ebd6ce',
        'surface-bright': '#fff8f6',
        'surface-variant': '#f3ded7',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#fff1ec',
        'surface-container': '#ffe9e2',
        'surface-container-high': '#f9e4dc',
        'surface-container-highest': '#f3ded7',
        'inverse-surface': '#3a2e29',
        'inverse-on-surface': '#ffede7',
        // On-surface text
        'on-background': '#241915',
        'on-surface': '#241915',
        'on-surface-variant': '#57423a',
        // Primary (Sunset Orange)
        primary: '#a33e06',
        'on-primary': '#ffffff',
        'primary-container': '#f47a42',
        'on-primary-container': '#5f2000',
        'inverse-primary': '#ffb597',
        'primary-fixed': '#ffdbcd',
        'primary-fixed-dim': '#ffb597',
        'on-primary-fixed': '#360f00',
        'on-primary-fixed-variant': '#7d2d00',
        // Secondary (Deep Navy)
        secondary: '#565e74',
        'on-secondary': '#ffffff',
        'secondary-container': '#dae2fd',
        'on-secondary-container': '#5c647a',
        'secondary-fixed': '#dae2fd',
        'secondary-fixed-dim': '#bec6e0',
        'on-secondary-fixed': '#131b2e',
        'on-secondary-fixed-variant': '#3f465c',
        // Tertiary (Emerald — success/heritage)
        tertiary: '#1b6b51',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#61ab8d',
        'on-tertiary-container': '#003d2b',
        'tertiary-fixed': '#a6f2d1',
        'tertiary-fixed-dim': '#8bd6b6',
        'on-tertiary-fixed': '#002116',
        'on-tertiary-fixed-variant': '#00513b',
        // Error
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        // Lines
        outline: '#8b7268',
        'outline-variant': '#dec0b5',
        'surface-tint': '#a33e06',
      },
      borderRadius: {
        sm: '0.5rem',
        DEFAULT: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
      spacing: {
        base: '8px',
        xs: '4px',
        sm: '12px',
        md: '24px',
        lg: '48px',
        xl: '80px',
        gutter: '24px',
        'margin-mobile': '20px',
        'margin-desktop': '64px',
      },
      maxWidth: {
        'max-width': '1280px',
      },
      fontFamily: {
        // CSS variables are set by next/font in the root layout.
        heading: ['var(--font-literata)', 'Literata', 'serif'],
        body: ['var(--font-dm-sans)', '"DM Sans"', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '700' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      boxShadow: {
        'level-1': '0px 4px 20px rgba(15, 23, 42, 0.05)',
        'level-2': '0px 12px 32px rgba(15, 23, 42, 0.08)',
        'nav-top': '0px -4px 20px rgba(15, 23, 42, 0.08)',
      },
    },
  },
};
