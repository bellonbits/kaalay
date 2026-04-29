import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import ClientShell from './ClientShell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Kaalay — Find, Meet, Move',
  description: 'Real-time location sharing and connection platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body suppressHydrationWarning style={{ height: '100dvh', overflow: 'hidden', background: '#F7F7F7', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
