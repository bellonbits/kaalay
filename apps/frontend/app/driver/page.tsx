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
  code: string; type: string; message?: string; lat: number; lng: number;
  userName?: string; timestamp?: number;
}

const TYPE_META: Record<string, { color: string; border: string; label: string }> = {
  lost:    { color: 'text-red-400',    border: 'border-red-500/30',    label: 'Lost Person' },
  pickup:  { color: 'text-[#7B61FF]', border: 'border-[#7B61FF]/30', label: 'Needs Pickup' },
  meetup:  { color: 'text-[#A8D83F]', border: 'border-[#A8D83F]/30', label: 'Meet Friends' },
  general: { color: 'text-[#8E8E9A]', border: 'border-[#555]/30',    label: 'Location Share' },
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function DriverPage() {
  const router = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [user] = useState(() => typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('kaalay_user') ?? '{}') : {});

  // Load existing public sessions
  useEffect(() => {
    getPublicSessions().then((sessions: any[]) => {
      const reqs = sessions.map(s => ({
        code: s.shareCode, type: s.requestType,
        message: s.message,
        lat: Number(s.latitude), lng: Number(s.longitude),
        userName: s.user?.fullName,
        timestamp: new Date(s.createdAt).getTime(),
      }));
      setRequests(reqs);
    }).catch(() => null);
  }, []);

  // Listen for incoming requests via Socket.IO
  const handleNewRequest = useCallback((req: Request) => {
    setRequests(prev => {
      if (prev.some(r => r.code === req.code)) return prev;
      return [req, ...prev];
    });
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !isOnline) return;
    s.emit('watch-requests');
    s.on('request', handleNewRequest);
    return () => { s.off('request', handleNewRequest); };
  }, [isOnline, handleNewRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast own location to Redis
  useEffect(() => {
    if (!position || !isOnline) return;
    const s = socketRef.current;
    if (!s) return;
    s.emit('driver:update_location', { driverId: user.id, lat: position.lat, lng: position.lng });
  }, [position, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...requests.map(r => ({ lat: r.lat, lng: r.lng, type: 'request' as const, label: r.userName })),
  ];

  const sorted = [...requests].sort((a, b) => {
    if (!position) return 0;
    return haversineKm(position, a) - haversineKm(position, b);
  });

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F]">
      {/* Map */}
      <div className="relative" style={{ height: '45%' }}>
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={13} markers={markers} className="w-full h-full" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12">
          <button onClick={() => router.push('/home')}
            className="w-10 h-10 rounded-full bg-[#141414]/90 backdrop-blur flex items-center justify-center border border-[#2A2A2A]">
            <img src="/back-arrow.png" alt="" className="w-5 h-5 opacity-70" />
          </button>
          {/* Online toggle */}
          <button
            onClick={() => setIsOnline(o => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm transition-all ${isOnline ? 'bg-[#A8D83F]/10 border-[#A8D83F] text-[#A8D83F]' : 'bg-[#141414]/90 border-[#2A2A2A] text-[#555]'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#A8D83F] animate-pulse' : 'bg-[#555]'}`} />
            {isOnline ? 'Online' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Requests list */}
      <div className="flex-1 bg-[#141414] rounded-t-3xl overflow-hidden flex flex-col" style={{ marginTop: '-16px' }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-[#333]" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3">
          <div>
            <h2 className="font-bold text-base">Nearby Requests</h2>
            <p className="text-xs text-[#555]">{sorted.length} active</p>
          </div>
          <img src="/target.png" alt="" className="w-5 h-5 opacity-40" />
        </div>

        {!isOnline ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <img src="/out.png" alt="" className="w-14 h-14 opacity-20" />
            <p className="text-sm text-[#555]">Go online to see and accept requests from people nearby</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <img src="/search.png" alt="" className="w-12 h-12 opacity-20" />
            <p className="text-sm text-[#555]">No requests nearby</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto sheet-scroll px-5 pb-4 space-y-3">
            {sorted.map(req => {
              const meta = TYPE_META[req.type] ?? TYPE_META.general;
              const dist = position ? haversineKm(position, req) : null;
              return (
                <div key={req.code} className={`bg-[#1A1A1A] rounded-2xl p-4 border ${meta.border}`}>
                  <div className="flex items-start gap-3">
                    <img src="/marker.png" alt="" className="w-10 h-10 opacity-70 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm truncate">{req.userName ?? 'Anonymous'}</span>
                        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                      </div>
                      {req.message && <p className="text-xs text-[#555] mb-2 line-clamp-2">{req.message}</p>}
                      <div className="flex items-center gap-4">
                        {dist !== null && (
                          <span className="text-xs font-bold text-[#A8D83F]">
                            {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                          </span>
                        )}
                        {req.timestamp && (
                          <span className="text-xs text-[#333]">{Math.round((Date.now() - req.timestamp) / 60000)}m ago</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/track/${req.code}`)}
                    className="w-full mt-3 py-3 rounded-xl bg-[#A8D83F] text-[#0F0F0F] font-bold text-sm"
                  >
                    View & Accept
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
