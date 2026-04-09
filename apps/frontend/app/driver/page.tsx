'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { getPublicSessions } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface Request {
  code: string; type: string; message?: string;
  lat: number; lng: number; userName?: string; timestamp?: number;
}

const TYPE_META: Record<string, { emoji: string; label: string; pill: string }> = {
  lost:    { emoji: '🆘', label: 'Lost Person',   pill: 'bg-red-100 text-red-600' },
  pickup:  { emoji: '🚗', label: 'Needs Pickup',  pill: 'bg-purple-100 text-purple-600' },
  meetup:  { emoji: '👥', label: 'Meet Friends',  pill: 'bg-green-100 text-green-600' },
  general: { emoji: '📍', label: 'Live Share',    pill: 'bg-gray-100 text-gray-600' },
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function DriverPage() {
  const router    = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();
  const [reqs,    setReqs]    = useState<Request[]>([]);
  const [online,  setOnline]  = useState(false);
  const [tab,     setTab]     = useState<'map' | 'list'>('map');
  const [user]    = useState(() =>
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('kaalay_user') ?? '{}') : {}
  );

  // Load existing public sessions
  useEffect(() => {
    getPublicSessions().then((ss: any[]) => {
      setReqs(ss.map(s => ({
        code: s.shareCode, type: s.requestType, message: s.message,
        lat: Number(s.latitude), lng: Number(s.longitude),
        userName: s.user?.fullName, timestamp: new Date(s.createdAt).getTime(),
      })));
    }).catch(() => null);
  }, []);

  // Live incoming requests
  const onRequest = useCallback((r: Request) => {
    setReqs(prev => prev.some(x => x.code === r.code) ? prev : [r, ...prev]);
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !online) return;
    s.emit('watch-requests');
    s.on('request', onRequest);
    return () => { s.off('request', onRequest); };
  }, [online, onRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast own position
  useEffect(() => {
    if (!position || !online || !socketRef.current) return;
    socketRef.current.emit('driver:update_location', { driverId: user.id, lat: position.lat, lng: position.lng });
  }, [position, online]); // eslint-disable-line react-hooks/exhaustive-deps

  const center = position ?? { lat: -1.2921, lng: 36.8219 };
  const sorted = [...reqs].sort((a, b) =>
    position ? km(position, a) - km(position, b) : 0
  );

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...reqs.map(r => ({ lat: r.lat, lng: r.lng, type: 'request' as const, label: r.userName })),
  ];

  return (
    <div className="h-full flex flex-col bg-bg">

      {/* ── Header ── */}
      <div className="bg-surface border-b border-border px-5 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/home')}
              className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0">
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <path d="M8 1L1 7L8 13M1 7H15" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-ink">Helper Dashboard</h1>
              <p className="text-xs text-muted">{user.fullName ?? 'Driver'}</p>
            </div>
          </div>

          {/* Online toggle — big, satisfying */}
          <button
            onClick={() => setOnline(o => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-sm transition-all ${
              online
                ? 'border-green-400 bg-green-50 text-green-700'
                : 'border-border bg-bg text-muted'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 pulse-dot' : 'bg-dim'}`} />
            {online ? 'Online' : 'Go online'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-bg border border-border p-1 rounded-2xl">
          {(['map', 'list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                tab === t ? 'bg-ink text-white shadow-sm' : 'text-muted'
              }`}>
              {t === 'map' ? '🗺️ Map view' : `📋 Requests (${sorted.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map tab ── */}
      {tab === 'map' && (
        <div className="flex-1 relative">
          <MapBase center={center} zoom={13} markers={markers} className="w-full h-full" />

          {/* Floating online banner */}
          {!online && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-8">
              <span className="text-5xl">🚗</span>
              <p className="text-xl font-black text-ink text-center">Go online to see requests</p>
              <p className="text-sm text-muted text-center">People nearby need help — tap "Go online" to start receiving requests</p>
              <button onClick={() => setOnline(true)} className="btn btn-black px-8 py-4">
                Go Online Now
              </button>
            </div>
          )}

          {/* Stats pill */}
          {online && (
            <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
              <div style={{ background: '#FFD600', borderRadius: '20px', padding: '8px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-ink pulse-dot" />
                <p className="text-sm font-black text-ink">{sorted.length} request{sorted.length !== 1 ? 's' : ''} nearby</p>
              </div>
            </div>
          )}

          {/* Mini list overlay — first 2 urgent */}
          {online && sorted.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              {sorted.slice(0, 2).map(r => {
                const m = TYPE_META[r.type] ?? TYPE_META.general;
                const d = position ? km(position, r) : null;
                return (
                  <button key={r.code} onClick={() => router.push(`/track/${r.code}`)}
                    className="w-full bg-surface rounded-2xl px-4 py-3 shadow-card border border-border flex items-center gap-3 text-left">
                    <span className="text-2xl">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{r.userName ?? 'Anonymous'}</p>
                      <p className="text-xs text-muted truncate">{r.message ?? m.label}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {d !== null && <p className="text-sm font-black text-ink">{d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}</p>}
                      <p className="text-[10px] text-muted mt-0.5">tap to accept</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── List tab ── */}
      {tab === 'list' && (
        <div className="flex-1 overflow-y-auto no-scroll px-5 py-4">
          {!online ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <span className="text-5xl">😴</span>
              <p className="text-xl font-black text-ink">You're offline</p>
              <p className="text-sm text-muted">Go online to see and accept requests from people nearby</p>
              <button onClick={() => setOnline(true)} className="btn btn-black px-8 py-4">Go Online</button>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <span className="text-4xl">🔍</span>
              <p className="text-lg font-bold text-ink">No requests yet</p>
              <p className="text-sm text-muted">Requests will appear here in real time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(r => {
                const m = TYPE_META[r.type] ?? TYPE_META.general;
                const d = position ? km(position, r) : null;
                const eta = d ? Math.round((d / 40) * 60) : null;
                const ago = r.timestamp ? Math.round((Date.now() - r.timestamp) / 60000) : null;

                return (
                  <div key={r.code} className="bg-surface rounded-3xl border border-border shadow-card overflow-hidden">
                    {/* Yellow ETA bar — like design */}
                    {d !== null && (
                      <div style={{ background: '#FFD600' }} className="px-4 py-2 flex items-center gap-2">
                        <span className="text-sm">{m.emoji}</span>
                        <p className="text-sm font-bold text-ink flex-1">
                          To this location&nbsp;
                          <span className="font-black">{eta} min</span>
                        </p>
                        {ago !== null && <p className="text-xs text-ink/50">{ago}m ago</p>}
                      </div>
                    )}

                    <div className="p-4">
                      {/* Start/finish row */}
                      <div className="flex items-center gap-3 mb-3 bg-bg rounded-xl px-3 py-2.5 border border-border">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <div className="w-px h-3 bg-border" />
                          <div className="w-2 h-2 rounded-sm bg-ink" />
                        </div>
                        <div className="flex-1 text-xs">
                          <p className="text-muted">My location</p>
                          <div className="h-px bg-border my-1" />
                          <p className="font-semibold text-ink">{r.userName ?? 'Anonymous'}</p>
                        </div>
                        {d !== null && (
                          <p className="text-sm font-black text-ink">
                            {d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}
                          </p>
                        )}
                      </div>

                      {r.message && (
                        <p className="text-xs text-muted bg-bg rounded-xl px-3 py-2 mb-3 border border-border italic">
                          "{r.message}"
                        </p>
                      )}

                      <div className="flex gap-2">
                        <span className={`pill ${m.pill} flex-shrink-0`}>{m.label}</span>
                        <div className="flex-1" />
                        <button
                          onClick={() => router.push(`/track/${r.code}`)}
                          className="btn btn-black px-5 py-2.5 text-sm rounded-xl">
                          View &amp; Accept
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
