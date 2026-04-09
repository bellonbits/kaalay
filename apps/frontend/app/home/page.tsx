'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getPublicSessions } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface Session {
  id: string; shareCode: string; latitude: number; longitude: number;
  requestType: string; message?: string;
  user?: { fullName: string };
}

const REQUEST_COLORS: Record<string, string> = {
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  pickup: 'bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/30',
  meetup: 'bg-[#A8D83F]/20 text-[#A8D83F] border-[#A8D83F]/30',
  general: 'bg-[#555]/20 text-[#8E8E9A] border-[#555]/30',
};

export default function HomePage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const [user, setUser] = useState<{ fullName: string; role: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetOpen, setSheetOpen] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    setUser(JSON.parse(u));
    getPublicSessions().then(setSessions).catch(() => null);
  }, [router]);

  const center = position ?? { lat: -1.2921, lng: 36.8219 }; // Nairobi default

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...sessions.map(s => ({
      lat: Number(s.latitude), lng: Number(s.longitude),
      type: 'request' as const, label: s.user?.fullName,
    })),
  ];

  const isHelper = user?.role === 'helper' || user?.role === 'driver';

  return (
    <div className="h-full flex flex-col relative bg-[#0F0F0F]">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <MapBase center={center} zoom={15} markers={markers} className="w-full h-full" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-2">
        <button onClick={() => router.push('/auth')}
          className="w-11 h-11 rounded-full bg-[#141414]/90 backdrop-blur flex items-center justify-center border border-[#2A2A2A]">
          <img src="/list.png" alt="menu" className="w-5 h-5 opacity-70" />
        </button>
        <div className="bg-[#141414]/90 backdrop-blur rounded-full px-4 py-2 border border-[#2A2A2A] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#A8D83F] animate-pulse" />
          <span className="text-sm font-semibold">{user?.fullName ?? 'You'}</span>
        </div>
        <button onClick={() => router.push(isHelper ? '/driver' : '/share')}
          className="w-11 h-11 rounded-full bg-[#A8D83F] flex items-center justify-center">
          <img src={isHelper ? '/target.png' : '/pin.png'} alt="" className="w-5 h-5" style={{ filter: 'brightness(0)' }} />
        </button>
      </div>

      {/* Bottom sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 bg-[#141414] rounded-t-3xl transition-transform duration-300 ${sheetOpen ? '' : 'translate-y-[calc(100%-72px)]'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1" onClick={() => setSheetOpen(o => !o)}>
          <div className="w-9 h-1 rounded-full bg-[#333]" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Share', icon: '/pin.png', href: '/share', color: 'bg-[#A8D83F]/10 border-[#A8D83F]/20' },
              { label: 'Request', icon: '/marker.png', href: '/request', color: 'bg-[#7B61FF]/10 border-[#7B61FF]/20' },
              { label: isHelper ? 'Dashboard' : 'Track', icon: isHelper ? '/target.png' : '/search.png', href: isHelper ? '/driver' : '/track/enter', color: 'bg-[#555]/10 border-[#555]/20' },
            ].map(a => (
              <button key={a.label} onClick={() => router.push(a.href)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${a.color}`}>
                <img src={a.icon} alt="" className="w-6 h-6 opacity-80" />
                <span className="text-xs font-semibold text-[#8E8E9A]">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Live nearby */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">Nearby Activity</span>
            <span className="text-xs text-[#A8D83F]">{sessions.length} live</span>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-[#555] text-center py-4">No public sessions nearby</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto sheet-scroll">
              {sessions.map(s => (
                <button key={s.id} onClick={() => router.push(`/track/${s.shareCode}`)}
                  className="w-full flex items-center gap-3 bg-[#1A1A1A] rounded-2xl px-4 py-3 border border-[#2A2A2A] text-left">
                  <img src="/marker.png" alt="" className="w-8 h-8 opacity-70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{s.user?.fullName ?? 'Anonymous'}</div>
                    <div className="text-xs text-[#555] truncate">{s.message ?? 'Live location'}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${REQUEST_COLORS[s.requestType] ?? REQUEST_COLORS.general}`}>
                    {s.requestType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
