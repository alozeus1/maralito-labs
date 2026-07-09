import type { Metadata, Viewport } from 'next';
import { Literata, DM_Sans } from 'next/font/google';
import './globals.css';
import { RegisterSw } from './RegisterSw';

// Stitch typography: Literata (serif display/headings) over DM Sans (body/UI). Loaded via
// next/font so weights are self-hosted and there's no FOUT — previously these families were
// referenced by name but never actually loaded, so the app fell back to system fonts.
const literata = Literata({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-literata',
  display: 'swap',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BorderPass',
  description: 'Your trusted bridge between the U.S. and Mexico.',
  // Phase 8A.6: installed-PWA metadata (manifest served by app/manifest.ts).
  appleWebApp: { capable: true, title: 'BorderPass', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

// Phase 8A.2: explicit mobile viewport + browser theme color (surface token).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fff8f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 1/2: locale from CustomerProfile drives <html lang>. Default: en.
  return (
    <html lang="en" className={`${literata.variable} ${dmSans.variable}`}>
      <body className="font-body text-on-surface bg-surface">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
