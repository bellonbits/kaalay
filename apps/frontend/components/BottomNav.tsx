'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Compass,        // Navigate — main map
  Users,          // Meet Friends
  HelpCircle,     // I'm Lost
  Radio,          // Share Location
  User,           // Profile
  Menu,
  X,
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

  // Hide on auth, register, and tracking screens
  if (['/auth', '/register', '/track'].some(p => pathname.startsWith(p)) || pathname === '/') return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] flex justify-center pointer-events-none">
      <div className="pointer-events-auto bg-white/95 backdrop-blur-xl px-3 py-2 rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.18)] flex items-center justify-around gap-0.5 w-full max-w-sm border border-black/8 relative">

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
              className={`
                relative flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-[22px]
                transition-all duration-300 active:scale-90 flex-1 min-w-0
                ${active ? 'shadow-md scale-105' : 'hover:bg-gray-50/80'}
              `}
              style={active ? { backgroundColor: item.color + '18' } : {}}
            >
              {/* SOS pulse ring */}
              {item.isSOS && (
                <span className="absolute inset-0 rounded-[22px] border-2 border-red-400/40 animate-ping pointer-events-none" />
              )}

              <Icon
                strokeWidth={active ? 2.5 : 1.8}
                className="w-[18px] h-[18px] transition-all duration-300 flex-shrink-0"
                style={{ color: active ? item.color : '#9ca3af' }}
              />
              <span
                className="text-[8px] font-black uppercase tracking-[0.8px] leading-none transition-colors whitespace-nowrap"
                style={{ color: active ? item.color : '#9ca3af' }}
              >
                {item.label}
              </span>

              {/* Active underline dot */}
              {active && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
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
