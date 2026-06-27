'use client';
import { useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { triggerEmergencySos } from '../lib/api';

const LONG_PRESS_MS = 650;

// Always-visible emergency entry point per the Kaaley Heedhe spec — a quick
// tap opens the full SOS flow on /home; holding it fires a Silent SOS
// (no navigation, no visible feedback beyond a brief vibration) for
// situations where opening the app and reading the screen isn't safe.
export default function EmergencySOSButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Read the query string directly (instead of useSearchParams) so this
  // component — mounted globally in the root layout — never forces a
  // Suspense boundary requirement on every route.
  const sosParamActive = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sos') === '1';

  const hidden =
    !user ||
    ['/auth', '/register'].some(p => pathname.startsWith(p)) ||
    pathname === '/' ||
    (pathname === '/home' && sosParamActive);

  const fireSilentSos = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy, heading } = pos.coords;
        try {
          await triggerEmergencySos({
            lat,
            lng,
            accuracy: accuracy ?? undefined,
            heading: heading ?? undefined,
            type: 'violence',
            severity: 'black',
            silent: true,
          });
        } catch (e) {
          console.error('Silent SOS failed', e);
        }
        if (navigator.vibrate) navigator.vibrate(60);
      },
      (err) => console.error('Silent SOS geolocation failed', err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );
  }, []);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      fireSilentSos();
    }, LONG_PRESS_MS);
  }, [fireSilentSos]);

  const handleClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return; // long-press already fired the silent SOS
    }
    router.push('/home?sos=1');
  }, [router]);

  if (hidden) return null;

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={clearPressTimer}
      onPointerLeave={clearPressTimer}
      onPointerCancel={clearPressTimer}
      onClick={handleClick}
      aria-label="Emergency SOS — tap for help, hold for silent alert"
      className="fixed right-4 z-[110] w-14 h-14 rounded-full bg-red-600 active:scale-95 transition-transform duration-150 shadow-[0_4px_16px_rgba(220,38,38,0.5)] flex items-center justify-center"
      style={{ bottom: 'calc(76px + var(--safe-bottom, 0px))' }}
    >
      <span className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping pointer-events-none" />
      <span className="relative text-white text-[11px] font-black uppercase tracking-wider leading-none">SOS</span>
    </button>
  );
}
