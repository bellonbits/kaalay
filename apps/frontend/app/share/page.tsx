'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { createSession, updateSessionStatus } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

const TYPES = [
  { id: 'general', label: 'Share Location', sub: 'Let others see where you are', emoji: '📍', yellow: false },
  { id: 'meetup',  label: 'Meet Friends',   sub: 'Invite friends to find you',   emoji: '👥', yellow: false },
  { id: 'pickup',  label: 'Need Pickup',    sub: 'Ask a driver to come to you',   emoji: '🚗', yellow: false },
  { id: 'lost',    label: "I'm Lost",       sub: 'Alert the community to help',   emoji: '🆘', yellow: false },
];

const DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
  { label: '4 hrs',  ms: 4 * 60 * 60 * 1000 },
  { label: '∞',      ms: 0 },
];

export default function SharePage() {
  const router    = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();
  const broadRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step,     setStep]     = useState<'setup' | 'live'>('setup');
  const [type,     setType]     = useState('general');
  const [dur,      setDur]      = useState(0);
  const [msg,      setMsg]      = useState('');
  const [session,  setSession]  = useState<{ shareCode: string } | null>(null);
  const [qr,       setQr]       = useState('');
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    if (!session) return;
    const url = `${window.location.origin}/track/${session.shareCode}`;
    QRCode.toDataURL(url, { width: 180, margin: 1 }).then(setQr).catch(() => null);
  }, [session]);

  // Live broadcasting
  useEffect(() => {
    if (step !== 'live' || !session || !position) return;
    const s = socketRef.current;
    if (!s) return;
    s.emit('join', session.shareCode);
    s.emit('new-request', { code: session.shareCode, type, message: msg, lat: position.lat, lng: position.lng,
      userName: JSON.parse(localStorage.getItem('kaalay_user') ?? '{}').fullName });
    broadRef.current = setInterval(() => {
      socketRef.current?.emit('push-location', {
        code: session.shareCode, lat: position.lat, lng: position.lng,
        accuracy: position.accuracy, heading: position.heading, timestamp: Date.now(),
      });
    }, 3000);
    return () => { if (broadRef.current) clearInterval(broadRef.current); };
  }, [step, session, position]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!position) return;
    const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
    try {
      const s = await createSession({
        latitude: position.lat, longitude: position.lng, accuracy: position.accuracy,
        requestType: type, visibility: type === 'general' ? 'link' : 'public',
        message: msg || undefined,
        expiresAt: dur > 0 ? new Date(Date.now() + dur).toISOString() : undefined,
        userId: user.id,
      });
      setSession(s);
    } catch {
      setSession({ shareCode: 'KAA-' + Math.random().toString(36).substring(2, 6).toUpperCase() });
    }
    setStep('live');
  };

  const stop = async () => {
    if (session) await updateSessionStatus(session.shareCode, 'ended').catch(() => null);
    if (broadRef.current) clearInterval(broadRef.current);
    router.push('/home');
  };

  const copy = () => { navigator.clipboard.writeText(session!.shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const markers: MarkerData[] = position
    ? [{ lat: position.lat, lng: position.lng, type: 'me', accuracy: position.accuracy }]
    : [];

  const selectedType = TYPES.find(t => t.id === type)!;

  /* ── LIVE VIEW ── */
  if (step === 'live' && session) return (
    <div className="h-full flex flex-col bg-bg">
      <div className="relative flex-1">
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />

        {/* Yellow ETA / info banner */}
        <div className="absolute bottom-0 left-0 right-0"
          style={{ background: '#FFD600', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="text-lg">{selectedType.emoji}</span>
          <div className="flex-1">
            <p className="text-xs font-bold text-ink/60 uppercase tracking-wide">{selectedType.label}</p>
            <p className="text-sm font-bold text-ink">Broadcasting your live location</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-ink pulse-dot" />
        </div>
      </div>

      {/* Code card */}
      <div className="bg-surface px-5 pt-5 pb-8 shadow-sheet">
        {/* Start / Finish row like Uber */}
        <div className="flex items-center gap-3 mb-5 bg-bg rounded-2xl px-4 py-3 border border-border">
          <div className="flex flex-col items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-ink" />
            <div className="w-px h-5 bg-border" />
            <div className="w-2.5 h-2.5 rounded-sm bg-ink" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted">From</p>
            <p className="text-sm font-bold text-ink">My location</p>
            <div className="h-px bg-border my-1.5" />
            <p className="text-xs text-muted">Sharing as</p>
            <p className="text-sm font-bold text-ink">{selectedType.label}</p>
          </div>
        </div>

        {/* Code + QR */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <p className="text-xs text-muted mb-1">Share code</p>
            <p className="text-3xl font-black tracking-widest text-ink">{session.shareCode}</p>
            <button onClick={copy}
              className="mt-2 flex items-center gap-2 text-xs font-bold text-muted bg-bg border border-border px-3 py-1.5 rounded-xl">
              {copied ? '✅ Copied!' : '📋 Copy code'}
            </button>
          </div>
          {qr && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-border flex-shrink-0">
              <img src={qr} alt="QR" className="w-full h-full" />
            </div>
          )}
        </div>

        <button onClick={stop}
          className="btn btn-ghost w-full border-red-200 text-red-500">
          ⏹ Stop sharing
        </button>
      </div>
    </div>
  );

  /* ── SETUP VIEW ── */
  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Map preview */}
      <div className="relative h-48 flex-shrink-0">
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />
        <button onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-surface shadow-card flex items-center justify-center">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <path d="M8 1L1 7L8 13M1 7H15" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Yellow banner */}
        <div className="absolute bottom-0 left-0 right-0 py-2 px-4 flex items-center gap-2"
          style={{ background: '#FFD600' }}>
          <span className="text-sm">{selectedType.emoji}</span>
          <p className="text-sm font-bold text-ink flex-1">{selectedType.label}</p>
          {position && <p className="text-xs font-bold text-ink/60">±{Math.round(position.accuracy ?? 0)}m accuracy</p>}
        </div>
      </div>

      {/* Setup form */}
      <div className="flex-1 bg-surface rounded-t-3xl overflow-y-auto no-scroll px-5 pt-6 pb-8 shadow-sheet" style={{ marginTop: '-1px' }}>

        {/* Type selector — horizontal scroll cards like design */}
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Session type</p>
        <div className="flex gap-3 overflow-x-auto no-scroll pb-1 mb-5">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`flex-shrink-0 w-32 p-4 rounded-2xl border-2 text-left transition-all ${
                type === t.id ? 'border-ink bg-ink text-white' : 'border-border bg-bg text-ink'
              }`}>
              <div className="text-2xl mb-2">{t.emoji}</div>
              <p className="text-xs font-bold leading-tight">{t.label}</p>
              <p className={`text-[10px] mt-1 leading-tight ${type === t.id ? 'text-white/60' : 'text-muted'}`}>{t.sub}</p>
            </button>
          ))}
        </div>

        {/* Start / Finish display */}
        <div className="flex items-center gap-4 mb-5 bg-bg rounded-2xl px-4 py-3 border border-border">
          <div className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="w-px h-4 bg-border" />
            <div className="w-2.5 h-2.5 rounded-sm bg-ink" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-ink">My location</p>
            <div className="h-px bg-border my-1" />
            <p className="font-medium text-muted">{selectedType.label} session</p>
          </div>
        </div>

        {/* Optional message */}
        <textarea
          className="input resize-none text-sm mb-4"
          rows={2}
          placeholder="Add a note (optional) — e.g. 'I'm at the blue gate'"
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />

        {/* Duration */}
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Duration</p>
        <div className="flex gap-2 mb-6">
          {DURATIONS.map(d => (
            <button key={d.ms} onClick={() => setDur(d.ms)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                dur === d.ms ? 'bg-ink text-white border-ink' : 'bg-bg text-muted border-border'
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Bottom actions like design: Cash/Option row + main button */}
        <div className="flex gap-3 mb-3">
          <button className="btn btn-ghost flex-1 text-sm py-3">
            <span>🔒</span>&nbsp;Private link
          </button>
          <button className="btn btn-ghost flex-1 text-sm py-3">
            <span>🌐</span>&nbsp;Public
          </button>
        </div>
        <button onClick={start} disabled={!position}
          className="btn btn-black w-full">
          {position ? 'Share Now' : 'Getting location…'}
        </button>
      </div>
    </div>
  );
}
