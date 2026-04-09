'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { useSessionSocket } from '../../../hooks/useSocket';
import { getSessionByCode } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type { MarkerData } from '../../../components/MapBase';

const MapBase = dynamic(() => import('../../../components/MapBase'), { ssr: false });

interface LivePos { lat: number; lng: number; accuracy?: number; timestamp: number }
interface Session { shareCode: string; requestType: string; message?: string; status: string; user?: { fullName: string } }

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ── Enter code view ──────────────────────────────────────────────────────
function EnterCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-6">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-surface shadow-card flex items-center justify-center flex-shrink-0">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <path d="M8 1L1 7L8 13M1 7H15" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-black text-ink">Track Someone</h1>
          <p className="text-xs text-muted">Enter the share code they sent you</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Code input */}
        <div className="w-full bg-surface rounded-3xl p-6 shadow-card border border-border">
          <p className="text-xs text-muted font-bold uppercase tracking-widest mb-3">Share code</p>
          <input
            className="w-full text-center text-3xl font-black tracking-[6px] text-ink bg-bg border-2 border-border rounded-2xl py-4 outline-none uppercase focus:border-ink"
            placeholder="KAA-XXXX"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <p className="text-xs text-muted text-center mt-3">Ask the person sharing to give you their code</p>
        </div>

        <button
          disabled={code.length < 6}
          onClick={() => router.push(`/track/${code}`)}
          className="btn btn-black w-full"
        >
          Track Live Location
        </button>
      </div>
    </div>
  );
}

// ── Live tracker ─────────────────────────────────────────────────────────
function LiveTracker({ code }: { code: string }) {
  const router   = useRouter();
  const { position: me } = useGeolocation(false);
  const [tracked, setTracked] = useState<LivePos | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ended,   setEnded]   = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('kaalay_user') ?? '{}') : {};
  const isHelper = user.role === 'helper' || user.role === 'driver';

  useEffect(() => { getSessionByCode(code).then(setSession).catch(() => null); }, [code]);

  useSessionSocket(
    code,
    useCallback((d: LivePos) => setTracked(d), []),
    useCallback((d: { status: string }) => { if (d.status === 'ended') setEnded(true); }, []),
    useCallback((d: { helperName: string }) => setAccepted(d.helperName), []),
  );

  const km = me && tracked ? dist(me, tracked) : null;
  const eta = km ? Math.round((km / 40) * 60) : null; // rough 40km/h

  const openMaps = () => tracked && window.open(`https://www.google.com/maps/dir/?api=1&destination=${tracked.lat},${tracked.lng}`, '_blank');
  const accept   = () => {
    getSocket().emit('accept-request', { code, helperName: user.fullName ?? 'Helper', helperId: user.id });
    openMaps();
  };

  const markers: MarkerData[] = [
    ...(me      ? [{ lat: me.lat,      lng: me.lng,      type: 'me'      as const, accuracy: me.accuracy }]       : []),
    ...(tracked ? [{ lat: tracked.lat, lng: tracked.lng, type: 'tracked' as const }]                               : []),
  ];

  const center = tracked ?? me ?? { lat: -1.29, lng: 36.82 };
  const typeEmoji: Record<string, string> = { lost: '🆘', pickup: '🚗', meetup: '👥', general: '📍' };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Map */}
      <div className="relative flex-1">
        <MapBase center={center} zoom={15} markers={markers}
          routeTo={isHelper && tracked ? tracked : undefined}
          className="w-full h-full" />

        {/* Back */}
        <button onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-surface shadow-card flex items-center justify-center">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <path d="M8 1L1 7L8 13M1 7H15" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* ETA pill — like design reference */}
        {(km !== null && !ended) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bounce-in"
            style={{ background: '#FFD600', borderRadius: '20px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            <span className="text-sm">{typeEmoji[session?.requestType ?? 'general']}</span>
            <p className="text-sm font-bold text-ink">
              To location&nbsp;
              <span className="font-black">{eta} min</span>
            </p>
          </div>
        )}

        {/* Code pill */}
        <div className="absolute top-12 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-surface/90 backdrop-blur-sm rounded-full px-4 py-1.5 border border-border shadow-card">
            <span className="text-xs font-black tracking-widest text-ink">{code}</span>
          </div>
        </div>

        {/* Ended overlay */}
        {ended && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-4">
            <span className="text-5xl">📍</span>
            <p className="text-xl font-black text-ink">Session ended</p>
            <p className="text-sm text-muted">This location share has stopped</p>
            <button onClick={() => router.push('/home')} className="btn btn-black px-8 py-3">Go home</button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-surface shadow-sheet px-5 pt-4 pb-8">
        {/* Accepted banner */}
        {accepted && (
          <div className="mb-4 flex items-center gap-3 bg-green-50 rounded-2xl p-3 border border-green-200">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-bold text-green-700">Help is on the way</p>
              <p className="text-xs text-green-600">{accepted} accepted your request</p>
            </div>
          </div>
        )}

        {/* Start / Finish row — exact design pattern */}
        <div className="flex items-center gap-4 mb-4 bg-bg rounded-2xl px-4 py-3 border border-border">
          <div className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="w-px h-4 bg-border" />
            <div className="w-2.5 h-2.5 rounded-sm bg-ink" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted">My location</p>
            <div className="h-px bg-border my-1.5" />
            <p className="text-xs text-muted">{session?.user?.fullName ?? 'Someone'}</p>
          </div>
          {km !== null && (
            <div className="text-right">
              <p className="text-lg font-black text-ink">{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</p>
              {eta && <p className="text-xs text-muted">~{eta} min</p>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={openMaps} className="btn btn-ghost flex-1 gap-2 py-3.5">
            🗺️ Navigate
          </button>
          {isHelper ? (
            <button onClick={accept} className="btn btn-black flex-1 py-3.5">
              Accept request
            </button>
          ) : (
            <button onClick={openMaps} className="btn btn-black flex-1 gap-2 py-3.5">
              Open Maps
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrackPage() {
  const params = useParams();
  const code = (params?.code as string) ?? '';
  if (code === 'enter') return <EnterCode />;
  return <LiveTracker code={code} />;
}
