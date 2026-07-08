import type { HTMLAttributes, ReactNode } from 'react';

// Responsive page container (single source of truth for content widths). Mobile-first: full-width
// with comfortable gutters; on larger screens it centers and widens to an intentional maximum.
// `_components` is a private folder (underscore) so Next.js never treats it as a route.
const VARIANTS = {
  wide: 'max-w-md sm:max-w-2xl lg:max-w-5xl', // lists / overview — allow multi-column grids
  read: 'max-w-md sm:max-w-2xl', // detail views — comfortable reading measure
  form: 'max-w-md', // forms / payment — stay narrow even on desktop
} as const;

interface PageMainProps extends HTMLAttributes<HTMLElement> {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}

export function PageMain({ variant = 'read', className = '', children, ...rest }: PageMainProps) {
  return (
    <main
      className={`mx-auto w-full px-6 py-8 sm:px-8 sm:py-10 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </main>
  );
}
