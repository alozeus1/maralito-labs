import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BorderPass',
  description: 'Your trusted bridge between the U.S. and Mexico.',
};

// Phase 8A.2: explicit mobile viewport + browser theme color (surface token). Full PWA
// manifest/icons arrive in 8A.6.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fff8f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 1/2: locale from CustomerProfile drives <html lang>. Phase 0 default: en.
  return (
    <html lang="en">
      <body className="font-body">{children}</body>
    </html>
  );
}
