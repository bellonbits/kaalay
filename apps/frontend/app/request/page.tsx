'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '../../hooks/useGeolocation';
import { createSession } from '../../lib/api';
import { getSocket } from '../../lib/socket';

const TYPES = [
  {
    id: 'lost',
    emoji: '🆘',
    label: "I'm Lost",
    sub: 'Alert nearby helpers to your location',
    border: 'border-red-200',
    activeBorder: 'border-red-400',
    activeBg: 'bg-red-50',
    pill: 'bg-red-100 text-red-600',
  },
  {
    id: 'pickup',
    emoji: '🚗',
    label: 'Need a Ride',
    sub: 'Request a driver or helper to pick you up',
    border: 'border-purple-200',
    activeBorder: 'border-purple-400',
    activeBg: 'bg-purple-50',
    pill: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'meetup',
    emoji: '👥',
    label: 'Meet Friends',
    sub: 'Share your location for friends to find you',
    border: 'border-green-200',
    activeBorder: 'border-green-400',
    activeBg: 'bg-green-50',
    pill: 'bg-green-100 text-green-600',
  },
];

export default function RequestPage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const [sel,     setSel]     = useState('');
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState<{ code: string; type: string } | null>(null);

  const submit = async () => {
    if (!sel || !position) return;
    setLoading(true);
    const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
    try {
      const s = await createSession({
        latitude: position.lat, longitude: position.lng, accuracy: position.accuracy,
        requestType: sel, visibility: 'public',
        message: msg || undefined, userId: user.id,
      });
      getSocket().emit('new-request', { code: s.shareCode, type: sel, message: msg, lat: position.lat, lng: position.lng, userName: user.fullName });
      setDone({ code: s.shareCode, type: sel });
    } catch {
      const code = 'KAA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      getSocket().emit('new-request', { code, type: sel, message: msg, lat: position.lat, lng: position.lng });
      setDone({ code, type: sel });
    } finally {
      setLoading(false);
    }
  };

  /* ── Done view ── */
  if (done) {
    const t = TYPES.find(x => x.id === done.type)!;
    return (
      <div className="h-full flex flex-col bg-bg">
        {/* Yellow top banner */}
        <div style={{ background: '#FFD600' }} className="px-6 pt-14 pb-6">
          <p className="text-xs font-bold text-ink/50 uppercase tracking-widest mb-1">Request sent</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{t.emoji}</span>
            <div>
              <h2 className="text-2xl font-black text-ink">{t.label}</h2>
              <p className="text-sm text-ink/60 font-medium">Helpers nearby have been notified</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-5 pt-6 gap-4">
          {/* Code card */}
          <div className="bg-surface rounded-3xl p-5 shadow-card border border-border">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="w-px h-6 bg-border" />
                <div className="w-2.5 h-2.5 rounded-sm bg-ink" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted">Your location</p>
                <div className="h-px bg-border my-1.5" />
                <p className="text-xs text-muted">Requesting</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tracking-widest text-ink">{done.code}</p>
                <p className="text-xs text-muted mt-0.5">Share this code</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          {[
            { n: '1', text: 'Helpers nearby can see your request on the map' },
            { n: '2', text: 'Share the code above with someone you trust' },
            { n: '3', text: 'They can track your live location instantly' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-ink text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <p className="text-sm text-muted leading-snug">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-8 flex flex-col gap-3">
          <button onClick={() => router.push(`/track/${done.code}`)} className="btn btn-black w-full">
            View my live session
          </button>
          <button onClick={() => router.push('/home')} className="btn btn-ghost w-full">
            Back to map
          </button>
        </div>
      </div>
    );
  }

  /* ── Form view ── */
  const selT = TYPES.find(t => t.id === sel);

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-surface px-5 pt-12 pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0">
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <path d="M8 1L1 7L8 13M1 7H15" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-ink">Request Help</h1>
            <p className="text-xs text-muted">What do you need?</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scroll px-5 py-5">
        {/* Type cards */}
        <div className="space-y-3 mb-6">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setSel(t.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-all ${
                sel === t.id ? `${t.activeBorder} ${t.activeBg}` : `${t.border} bg-surface`
              }`}>
              <div className="w-14 h-14 rounded-2xl bg-bg flex items-center justify-center text-3xl flex-shrink-0">
                {t.emoji}
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink">{t.label}</p>
                <p className="text-xs text-muted mt-0.5 leading-snug">{t.sub}</p>
              </div>
              {sel === t.id && (
                <div className="w-6 h-6 rounded-full bg-ink text-white text-xs flex items-center justify-center flex-shrink-0">
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Message */}
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Message (optional)</p>
        <textarea
          className="input resize-none text-sm mb-4"
          rows={3}
          placeholder={sel === 'lost' ? "Describe where you are — e.g. 'Near the blue gate on Kenyatta Ave'" : "Any details helpers should know…"}
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />

        {/* Location status */}
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 border ${position ? 'bg-green-50 border-green-200' : 'bg-bg border-border'}`}>
          <span className="text-lg">{position ? '✅' : '⏳'}</span>
          <div>
            <p className="text-sm font-bold text-ink">{position ? 'Location ready' : 'Getting your location…'}</p>
            {position && <p className="text-xs text-muted">±{Math.round(position.accuracy ?? 0)}m accuracy</p>}
          </div>
        </div>
      </div>

      {/* Bottom actions — like design: two secondary + main */}
      <div className="bg-surface border-t border-border px-5 pt-3 pb-8">
        {selT && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selT.emoji}</span>
              <span className="text-sm font-bold text-ink">{selT.label}</span>
            </div>
            <span className={`pill ${selT.pill}`}>selected</span>
          </div>
        )}
        <button
          onClick={submit}
          disabled={!sel || !position || loading}
          className="btn btn-black w-full"
        >
          {loading ? 'Sending request…' : 'Send Request'}
        </button>
      </div>
    </div>
  );
}
