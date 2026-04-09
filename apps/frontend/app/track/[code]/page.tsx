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

interface LivePosition { lat: number; lng: number; accuracy?: number; timestamp: number }
interface Session {
  shareCode: string; requestType: string; message?: string; status: string;
  user?: { fullName: string; role: string };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Special route for manual code entry
function EnterCodeView() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#0F0F0F] px-6 gap-6">
      <img src="/search.png" alt="" className="w-16 h-16 opacity-30" />
      <h2 className="text-xl font-bold">Enter Share Code</h2>
      <input
        className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-5 py-4 text-center text-xl font-bold tracking-widest text-[#A8D83F] outline-none uppercase"
        placeholder="KAA-XXXX"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        maxLength={8}
      />
      <button
        disabled={code.length < 6}
        onClick={() => router.push(`/track/${code}`)}
        className="w-full py-4 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold disabled:opacity-40"
      >
        Track Location
      </button>
    </div>
  );
}

export default function TrackPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? '';

  if (code === 'enter') return <EnterCodeView />;

  return <LiveTracker code={code} />;
}

function LiveTracker({ code }: { code: string }) {
  const router = useRouter();
  const { position: myPos } = useGeolocation(false);
  const [tracked, setTracked] = useState<LivePosition | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [helperAccepted, setHelperAccepted] = useState<string | null>(null);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('kaalay_user') ?? '{}') : {};
  const isHelper = user.role === 'helper' || user.role === 'driver';

  // Load session metadata
  useEffect(() => {
    getSessionByCode(code).then(setSession).catch(() => null);
  }, [code]);

  // Live location via Socket.IO
  const handleLocation = useCallback((data: LivePosition) => {
    setTracked(data);
  }, []);
  const handleStatus = useCallback((data: { status: string }) => {
    if (data.status === 'ended') setSessionEnded(true);
  }, []);
  const handleAccepted = useCallback((data: { helperName: string }) => {
    setHelperAccepted(data.helperName);
  }, []);

  useSessionSocket(code, handleLocation, handleStatus, handleAccepted);

  const dist = myPos && tracked
    ? haversineKm(myPos, tracked)
    : null;

  const openGoogleMaps = () => {
    if (!tracked) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${tracked.lat},${tracked.lng}`, '_blank');
  };

  const acceptRequest = () => {
    const s = getSocket();
    s.emit('accept-request', { code, helperName: user.fullName ?? 'Helper', helperId: user.id });
    router.push(`/navigate?lat=${tracked?.lat}&lng=${tracked?.lng}&code=${code}`);
  };

  const markers: MarkerData[] = [
    ...(myPos ? [{ lat: myPos.lat, lng: myPos.lng, type: 'me' as const, accuracy: myPos.accuracy }] : []),
    ...(tracked ? [{ lat: tracked.lat, lng: tracked.lng, type: 'tracked' as const, label: session?.user?.fullName }] : []),
  ];

  const center = tracked ?? myPos ?? { lat: -1.29, lng: 36.82 };
  const typeColor: Record<string, string> = {
    lost: 'text-red-400', pickup: 'text-[#7B61FF]', meetup: 'text-[#A8D83F]', general: 'text-[#8E8E9A]',
  };

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F]">
      {/* Map */}
      <div className="relative flex-1">
        <MapBase
          center={center}
          zoom={15}
          markers={markers}
          routeTo={isHelper && tracked ? tracked : undefined}
          className="w-full h-full"
        />

        {/* Back */}
        <button onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-[#141414]/90 backdrop-blur flex items-center justify-center border border-[#2A2A2A]">
          <img src="/back-arrow.png" alt="" className="w-5 h-5 opacity-70" />
        </button>

        {/* Code pill */}
        <div className="absolute top-12 left-0 right-0 flex justify-center">
          <div className="bg-[#141414]/90 backdrop-blur rounded-full px-4 py-2 border border-[#2A2A2A]">
            <span className="text-sm font-bold tracking-widest text-[#A8D83F]">{code}</span>
          </div>
        </div>

        {/* Tracked pulse */}
        {tracked && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-red-500/20 pulse-ring" />
          </div>
        )}

        {sessionEnded && (
          <div className="absolute inset-0 bg-[#0F0F0F]/80 flex items-center justify-center">
            <div className="text-center px-8">
              <img src="/close.png" alt="" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-bold">Session Ended</p>
              <p className="text-sm text-[#555] mt-1">This location share has stopped</p>
              <button onClick={() => router.push('/home')} className="mt-4 px-6 py-3 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] text-sm font-semibold">
                Go Home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-[#141414] rounded-t-3xl px-5 pt-5 pb-8 slide-up">
        {helperAccepted && (
          <div className="mb-4 p-3 rounded-2xl bg-[#A8D83F]/10 border border-[#A8D83F]/30 flex items-center gap-3">
            <img src="/check.png" alt="" className="w-8 h-8" />
            <div>
              <p className="text-sm font-bold text-[#A8D83F]">Help is on the way!</p>
              <p className="text-xs text-[#8E8E9A]">{helperAccepted} accepted your request</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0">
            <img src="/person.png" alt="" className="w-6 h-6 opacity-60" />
          </div>
          <div className="flex-1">
            <p className="font-bold">{session?.user?.fullName ?? 'Anonymous'}</p>
            <p className={`text-sm font-semibold ${typeColor[session?.requestType ?? 'general']}`}>
              {session?.requestType ?? 'Live location'}
            </p>
            {session?.message && <p className="text-xs text-[#555] mt-1">{session.message}</p>}
          </div>
          {dist !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-[#A8D83F]">{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}</p>
              <p className="text-xs text-[#555]">away</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={openGoogleMaps}
            className="flex-1 py-3 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center gap-2">
            <img src="/map.png" alt="" className="w-5 h-5 opacity-60" />
            <span className="text-sm font-semibold">Navigate</span>
          </button>
          {isHelper && (
            <button onClick={acceptRequest}
              className="flex-1 py-3 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold text-sm">
              Accept Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
