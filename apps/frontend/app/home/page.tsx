'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getPublicSessions } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface Session {
  id: string; shareCode: string; latitude: number; longitude: number;
  requestType: string; message?: string; user?: { fullName: string };
}

const TYPE_META: Record<string, { bg: string; text: string; label: string }> = {
  lost:    { bg: 'bg-red-100',    text: 'text-red-600',    label: 'Lost' },
  pickup:  { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Pickup' },
  meetup:  { bg: 'bg-green-100',  text: 'text-green-600',  label: 'Meetup' },
  general: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Live' },
};

// Scattered fake car positions for visual richness (offset from user)
const CAR_OFFSETS = [
  { dlat: 0.012, dlng: -0.018 }, { dlat: -0.009, dlng: 0.022 },
  { dlat: 0.020, dlng: 0.011 },  { dlat: -0.016, dlng: -0.014 },
  { dlat: 0.007, dlng: 0.028 },
];

export default function HomePage() {
  const router  = useRouter();
  const { position } = useGeolocation(false);
  const [user,     setUser]     = useState<{ fullName: string; role: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetH,   setSheetH]   = useState<'peek' | 'half' | 'full'>('peek');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    setUser(JSON.parse(u));
    getPublicSessions().then(setSessions).catch(() => null);
  }, [router]);

  const center = position ?? { lat: -1.2921, lng: 36.8219 };
  const isHelper = user?.role === 'helper' || user?.role === 'driver';

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...CAR_OFFSETS.map(o => ({
      lat: center.lat + o.dlat, lng: center.lng + o.dlng, type: 'car' as const,
    })),
    ...sessions.slice(0, 4).map(s => ({
      lat: Number(s.latitude), lng: Number(s.longitude), type: 'request' as const, label: s.user?.fullName,
    })),
  ];

  const sheetClass = sheetH === 'peek'
    ? 'translate-y-[calc(100%-148px)]'
    : sheetH === 'half'
    ? 'translate-y-[calc(100%-360px)]'
    : 'translate-y-0';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push('/share');
  };

  const QUICK = [
    { label: 'Share',   emoji: '📍', href: '/share',    color: 'bg-[#FFD600] text-ink' },
    { label: 'Help',    emoji: '🆘', href: '/request',  color: 'bg-ink text-white' },
    { label: 'Track',   emoji: '🔍', href: '/track/enter', color: 'bg-bg border border-border text-ink' },
    { label: isHelper ? 'Requests' : 'Meet', emoji: isHelper ? '🚗' : '👥',
      href: isHelper ? '/driver' : '/share', color: 'bg-bg border border-border text-ink' },
  ];

  return (
    <div className="h-full relative overflow-hidden bg-bg">

      {/* Full-screen map */}
      <div className="absolute inset-0">
        <MapBase center={center} zoom={14} markers={markers} className="w-full h-full" />
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-3 pointer-events-none">
        <button
          onClick={() => router.push('/auth')}
          className="pointer-events-auto w-11 h-11 rounded-full bg-surface shadow-card flex items-center justify-center"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect width="18" height="2" rx="1" fill="#1A1A1A"/>
            <rect y="6" width="12" height="2" rx="1" fill="#1A1A1A"/>
            <rect y="12" width="18" height="2" rx="1" fill="#1A1A1A"/>
          </svg>
        </button>

        {/* ETA badge — shown when position known */}
        {position && (
          <div className="pointer-events-auto flex items-center gap-2 bg-ink text-white px-4 py-2 rounded-full shadow-pin bounce-in">
            <div className="w-2 h-2 rounded-full bg-[#FFD600] pulse-dot" />
            <span className="text-xs font-bold">Live · {sessions.length} nearby</span>
          </div>
        )}

        <button
          onClick={() => router.push(isHelper ? '/driver' : '/share')}
          className="pointer-events-auto w-11 h-11 rounded-full bg-surface shadow-card flex items-center justify-center text-lg"
        >
          🔔
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 bg-surface rounded-t-3xl shadow-sheet transition-transform duration-400 ease-out ${sheetClass}`}
        style={{ height: '85%' }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}
        >
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-4">
          {/* Greeting */}
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-muted text-sm font-medium">Good time to connect</p>
              <h2 className="text-2xl font-black text-ink leading-none mt-0.5">
                {user?.fullName?.split(' ')[0] ?? 'Hey'} 👋
              </h2>
            </div>
            <div className="flex items-center gap-1.5 bg-bg border border-border rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-ink">Now</span>
              <span className="text-muted text-xs">↓</span>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative mb-5">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
            <input
              className="input pl-10 text-sm font-medium"
              placeholder="Where are you going?"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSheetH('half')}
            />
          </form>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {QUICK.map(q => (
              <button
                key={q.label}
                onClick={() => router.push(q.href)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl ${q.color}`}
              >
                <span className="text-xl">{q.emoji}</span>
                <span className="text-xs font-bold">{q.label}</span>
              </button>
            ))}
          </div>

          {/* Live nearby */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-ink">Nearby activity</p>
            <span className="text-xs font-semibold text-muted">{sessions.length} live</span>
          </div>

          {sessions.length === 0 ? (
            <div className="flex items-center gap-3 bg-bg rounded-2xl p-4 border border-border">
              <span className="text-2xl">🗺️</span>
              <div>
                <p className="text-sm font-semibold text-ink">All quiet nearby</p>
                <p className="text-xs text-muted">Be the first to share your location</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 no-scroll overflow-y-auto" style={{ maxHeight: '200px' }}>
              {sessions.map(s => {
                const m = TYPE_META[s.requestType] ?? TYPE_META.general;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/track/${s.shareCode}`)}
                    className="w-full flex items-center gap-3 bg-bg border border-border rounded-2xl px-4 py-3 text-left"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${m.bg}`}>
                      {s.requestType === 'lost' ? '🆘' : s.requestType === 'pickup' ? '🚗' : s.requestType === 'meetup' ? '👥' : '📍'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{s.user?.fullName ?? 'Someone'}</p>
                      <p className="text-xs text-muted truncate">{s.message ?? 'Live location'}</p>
                    </div>
                    <span className={`pill ${m.bg} ${m.text}`}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
