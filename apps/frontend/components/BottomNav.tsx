'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Car, Share2, MapPin, User, X, Menu } from 'lucide-react';

const ITEMS = [
  { label: 'Home',    icon: Home,      path: '/home' },
  { label: 'Rides',   icon: Car,       path: '/ride' },
  { label: 'Share',   icon: Share2,     path: '/share' },
  { label: 'Places',  icon: MapPin,    path: '/discover' },
  { label: 'Profile', icon: User,      path: '/profile' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);

  // Hide on critical journey screens
  if (['/auth', '/register', '/track'].some(p => pathname.startsWith(p)) || pathname === '/') return null;

  return (
    <>
      {/* Minimized Toggle Button */}
      <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isVisible ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}`}>
        <button 
          onClick={() => setIsVisible(true)} 
          className="w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-transform border-2 border-white/20"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Main Navigation Bar */}
      <div className={`fixed bottom-6 left-6 right-6 z-[100] flex justify-center pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isVisible ? 'translate-y-0' : 'translate-y-32'}`}>
        <div className="pointer-events-auto glass-premium px-4 py-2.5 rounded-[32px] shadow-premium flex items-center justify-around gap-1 w-full max-w-sm border border-white/40 relative">
          
          {/* Close / Hide Button */}
          <button 
            onClick={() => setIsVisible(false)}
            className="absolute -top-3 -right-2 w-8 h-8 bg-black rounded-full shadow-premium flex items-center justify-center active:scale-90 transition-transform border-2 border-white z-10"
          >
            <X className="w-4 h-4 text-white" strokeWidth={3} />
          </button>

          {ITEMS.map(item => {
            const active = pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/home');
            const Icon = item.icon;
            
            return (
              <button 
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-[24px] transition-all duration-300 active:scale-90 ${active ? 'bg-black shadow-lg scale-105' : 'hover:bg-gray-100/50'}`}
              >
                <Icon 
                  strokeWidth={active ? 3 : 2} 
                  className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-gray-400'}`} 
                  fill={active ? "currentColor" : "none"} 
                />
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${active ? 'text-white' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
