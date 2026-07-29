import type { MetadataRoute } from 'next';

// Phase 8A.6/8A.9: PWA manifest (installability). Real BorderPass brand icon (bridge + "B" monogram,
// terracotta on cream) generated from the owner-supplied source; dedicated full-bleed maskable variant.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BorderPass',
    short_name: 'BorderPass',
    description: 'Your trusted bridge between the U.S. and Mexico.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff8f6',
    theme_color: '#fff8f6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
