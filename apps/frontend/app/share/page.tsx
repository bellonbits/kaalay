'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { createSession, updateSessionStatus } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

const SESSION_TYPES = [
  { id: 'general', label: 'Share Location', icon: '/pin.png', color: '#8E8E9A', desc: 'Share your live position' },
  { id: 'meetup', label: 'Meet Friends', icon: '/person.png', color: '#A8D83F', desc: 'Invite friends to find you' },
  { id: 'pickup', label: 'Request Pickup', icon: '/out.png', color: '#7B61FF', desc: 'Ask a driver to pick you up' },
  { id: 'lost', label: "I'm Lost", icon: '/marker.png', color: '#FF6B6B', desc: 'Ask community to help you' },
];

const DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: 'Until I stop', ms: 0 },
];

export default function SharePage() {
  const router = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();

  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const [type, setType] = useState('general');
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<{ shareCode: string } | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const broadcastRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate QR when session code is set
  useEffect(() => {
    if (!session) return;
    const url = `${window.location.origin}/track/${session.shareCode}`;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#000000', light: '#A8D83F' } })
      .then(setQrUrl).catch(() => null);
  }, [session]);

  // Broadcast location every 3 seconds
  useEffect(() => {
    if (step !== 'live' || !session || !position) return;
    const s = socketRef.current;
    if (!s) return;

    s.emit('join', session.shareCode);
    if (type === 'lost' || type === 'pickup' || type === 'general') {
      s.emit('new-request', {
        code: session.shareCode,
        type,
        message,
        lat: position.lat,
        lng: position.lng,
        userName: JSON.parse(localStorage.getItem('kaalay_user') ?? '{}').fullName,
      });
    }

    broadcastRef.current = setInterval(() => {
      if (!socketRef.current || !position) return;
      socketRef.current.emit('push-location', {
        code: session.shareCode,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
        timestamp: Date.now(),
      });
    }, 3000);

    return () => { if (broadcastRef.current) clearInterval(broadcastRef.current); };
  }, [step, session, position]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = async () => {
    if (!position) return;
    const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
    const expiresAt = duration > 0 ? new Date(Date.now() + duration).toISOString() : undefined;
    try {
      const s = await createSession({
        latitude: position.lat, longitude: position.lng,
        accuracy: position.accuracy,
        requestType: type, visibility: type === 'general' ? 'link' : 'public',
        message: message || undefined,
        expiresAt,
        userId: user.id,
      });
      setSession(s);
      setStep('live');
    } catch {
      // Fallback: generate local code
      const code = 'KAA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      setSession({ shareCode: code });
      setStep('live');
    }
  };

  const stopSession = async () => {
    if (session) await updateSessionStatus(session.shareCode, 'ended').catch(() => null);
    if (broadcastRef.current) clearInterval(broadcastRef.current);
    router.push('/home');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(session!.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markers: MarkerData[] = position
    ? [{ lat: position.lat, lng: position.lng, type: 'me', accuracy: position.accuracy }]
    : [];

  if (step === 'live' && session) {
    return (
      <div className="h-full flex flex-col bg-[#0F0F0F]">
        {/* Map */}
        <div className="relative flex-1">
          <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />
          {/* Live badge */}
          <div className="absolute top-12 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-2 bg-[#141414]/90 backdrop-blur rounded-full px-4 py-2 border border-[#A8D83F]/30">
              <div className="w-2 h-2 rounded-full bg-[#A8D83F] animate-pulse" />
              <span className="text-sm font-bold text-[#A8D83F]">Sharing Live</span>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-[#141414] rounded-t-3xl px-5 pt-5 pb-8">
          <div className="flex items-center gap-4 mb-5">
            {/* Code */}
            <div className="flex-1">
              <p className="text-xs text-[#555] mb-1">Share code</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-wider text-[#A8D83F]">{session.shareCode}</span>
                <button onClick={copyCode} className="p-2 rounded-xl bg-[#1A1A1A]">
                  <img src={copied ? '/check.png' : '/list.png'} alt="" className="w-4 h-4 opacity-60" />
                </button>
              </div>
            </div>
            {/* QR */}
            {qrUrl && (
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#2A2A2A] flex-shrink-0">
                <img src={qrUrl} alt="QR" className="w-full h-full" />
              </div>
            )}
          </div>

          <p className="text-xs text-[#555] mb-4">Anyone with this code or link can see your live location</p>

          <button onClick={stopSession}
            className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-sm">
            Stop Sharing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F]">
      {/* Map preview */}
      <div className="relative h-52 flex-shrink-0">
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />
        <button onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-[#141414]/90 backdrop-blur flex items-center justify-center border border-[#2A2A2A]">
          <img src="/back-arrow.png" alt="back" className="w-5 h-5 opacity-70" />
        </button>
        {!position && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0F0F0F]/60">
            <p className="text-sm text-[#8E8E9A]">Getting your location...</p>
          </div>
        )}
      </div>

      {/* Setup form */}
      <div className="flex-1 bg-[#141414] rounded-t-3xl overflow-y-auto sheet-scroll px-5 pt-6 pb-8">
        <h2 className="text-lg font-bold mb-4">What are you sharing?</h2>

        {/* Session type */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SESSION_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${type === t.id ? 'border-[#A8D83F] bg-[#A8D83F]/10' : 'border-[#2A2A2A] bg-[#1A1A1A]'}`}>
              <img src={t.icon} alt="" className="w-6 h-6 mb-2" style={{ filter: `drop-shadow(0 0 4px ${t.color})` }} />
              <div className="text-sm font-bold">{t.label}</div>
              <div className="text-xs text-[#555] mt-1">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Message */}
        <textarea
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555] outline-none resize-none mb-4"
          rows={2}
          placeholder="Add a message (optional)"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />

        {/* Duration */}
        <p className="text-xs text-[#555] mb-2">Sharing duration</p>
        <div className="flex gap-2 mb-6 flex-wrap">
          {DURATIONS.map(d => (
            <button key={d.ms} onClick={() => setDuration(d.ms)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${duration === d.ms ? 'border-[#A8D83F] bg-[#A8D83F]/10 text-[#A8D83F]' : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#555]'}`}>
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={startSession}
          disabled={!position}
          className="w-full py-4 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold disabled:opacity-40"
        >
          {position ? 'Start Sharing' : 'Getting location...'}
        </button>
      </div>
    </div>
  );
}
