import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BorderPass',
  description: 'Your trusted bridge between the U.S. and Mexico.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 1/2: locale from CustomerProfile drives <html lang>. Phase 0 default: en.
  return (
    <html lang="en">
      <body className="font-body">{children}</body>
    </html>
  );
}
