'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Compass,        // Navigate — main map
  Users,          // Meet Friends
  HelpCircle,     // I'm Lost
  Radio,          // Share Location
  User,           // Profile
} from 'lucide-react';

const ITEMS = [
  {
    label: 'Navigate',
    icon: Compass,
    path: '/home',
    color: '#000080',        // Dark Blue — primary action
    description: 'Map & directions',
  },
  {
    label: 'Meet',
    icon: Users,
    path: '/meet',
    color: '#34d399',        // Emerald — social
    description: 'Meet friends',
  },
  {
    label: "I'm Lost",
    icon: HelpCircle,
    path: '/home?sos=1',
    matchPath: '/home',      // highlight on /home when sos param active
    color: '#f87171',        // Red — SOS / urgency
    description: 'Get help now',
    isSOS: true,
  },
  {
    label: 'Share',
    icon: Radio,
    path: '/share',
    color: '#818cf8',        // Indigo — broadcast
    description: 'Share location',
  },
  {
    label: 'Profile',
    icon: User,
    path: '/profile',
    color: '#94a3b8',        // Slate — neutral
    description: 'Your account',
  },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [eventHide, setEventHide] = useState(false);

  useEffect(() => {
    const handleHide = (e: Event) => {
      const customEvent = e as CustomEvent;
      setEventHide(!!customEvent.detail);
    };
    window.addEventListener('hide-bottom-nav', handleHide);
    return () => window.removeEventListener('hide-bottom-nav', handleHide);
  }, []);

  // Hard hide on root, auth, and register
  if (['/auth', '/register'].some(p => pathname.startsWith(p)) || pathname === '/') {
    return null;
  }

  // Soft transition hide on tracking, ride, or event-driven states
  const shouldTransitionHide = 
    eventHide || 
    ['/track', '/ride'].some(p => pathname.startsWith(p));

  return (
    <div className={`fixed bottom-0 left-0 right-0 h-16 z-[100] bg-white border-t border-gray-100/90 flex items-center justify-center transition-all duration-500 ease-in-out ${shouldTransitionHide ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      <div className="flex items-center justify-around w-full max-w-md h-full px-2">

        {ITEMS.map(item => {
          const active =
            item.isSOS
              ? false // never highlight SOS as "active page"
              : pathname === item.path ||
                (pathname.startsWith(item.path) && item.path !== '/home');
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              id={`nav-tab-${item.label.toLowerCase().replace(/[^a-z]/g, '-')}`}
              onClick={() => router.push(item.path)}
              className="relative flex flex-col items-center justify-center gap-1 py-1 transition-all duration-300 active:scale-95 flex-1 min-w-0"
            >
              {/* SOS pulse ring */}
              {item.isSOS && (
                <span className="absolute inset-0 rounded-full border-2 border-red-400/40 animate-ping pointer-events-none" />
              )}

              <Icon
                strokeWidth={active ? 2.5 : 1.8}
                className="w-5 h-5 transition-all duration-300 flex-shrink-0"
                style={{ color: active ? item.color : '#9ca3af' }}
              />
              <span
                className="text-[9px] font-black uppercase tracking-[0.8px] leading-none transition-colors whitespace-nowrap"
                style={{ color: active ? item.color : '#9ca3af' }}
              >
                {item.label}
              </span>

              {/* Active underline dot */}
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
