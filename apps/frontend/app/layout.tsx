import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import ClientShell from './ClientShell';
import './globals.css';
import BottomNav from '../components/BottomNav';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Kaalay • Precision Location',
  description: 'Precision local mapping and live coordination using what3words',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} h-full w-full overflow-hidden`}>
      <head>
        <script type="module" src="https://cdn.what3words.com/javascript-components@5.0.0/dist/what3words/what3words.esm.js"></script>
        <script noModule src={`https://cdn.what3words.com/javascript-components@5.0.0/dist/what3words/what3words.js?key=${process.env.NEXT_PUBLIC_W3W_API_KEY || 'Z5Z6G74L'}`}></script>
        <script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&libraries=places,geometry`}></script>
      </head>
      <body 
        suppressHydrationWarning 
        className="h-full w-full overflow-hidden bg-white selection:bg-yellow-100"
        style={{ fontFamily: 'var(--font-outfit), sans-serif', maxWidth: '100vw' }}
      >
        <ClientShell>
          <div className="flex flex-col h-full w-full overflow-hidden">
            <main className="flex-1 relative overflow-hidden w-full">
              {children}
            </main>
            <BottomNav />
          </div>
        </ClientShell>
      </body>
    </html>
  );
}
