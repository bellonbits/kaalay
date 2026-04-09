'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '../../hooks/useGeolocation';
import { createSession } from '../../lib/api';
import { getSocket } from '../../lib/socket';

const REQUEST_TYPES = [
  {
    id: 'lost',
    label: "I'm Lost",
    sublabel: 'Share your location with the community',
    icon: '/marker.png',
    bg: 'bg-red-500/10 border-red-500/30',
    active: 'bg-red-500/20 border-red-500',
    iconFilter: 'drop-shadow(0 0 8px rgba(239,68,68,0.8))',
    color: 'text-red-400',
  },
  {
    id: 'pickup',
    label: 'Need a Pickup',
    sublabel: 'Request drivers or helpers nearby',
    icon: '/out.png',
    bg: 'bg-[#7B61FF]/10 border-[#7B61FF]/30',
    active: 'bg-[#7B61FF]/20 border-[#7B61FF]',
    iconFilter: 'drop-shadow(0 0 8px rgba(123,97,255,0.8))',
    color: 'text-[#7B61FF]',
  },
  {
    id: 'meetup',
    label: 'Meet Friends',
    sublabel: 'Let friends see your live location',
    icon: '/person.png',
    bg: 'bg-[#A8D83F]/10 border-[#A8D83F]/30',
    active: 'bg-[#A8D83F]/20 border-[#A8D83F]',
    iconFilter: 'drop-shadow(0 0 8px rgba(168,216,63,0.8))',
    color: 'text-[#A8D83F]',
  },
];

export default function RequestPage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ code: string; type: string } | null>(null);

  const submit = async () => {
    if (!selected || !position) return;
    setLoading(true);
    const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
    try {
      const s = await createSession({
        latitude: position.lat, longitude: position.lng,
        accuracy: position.accuracy,
        requestType: selected,
        visibility: 'public',
        message: message || undefined,
        userId: user.id,
      });
      // Broadcast request to helpers
      const socket = getSocket();
      socket.emit('new-request', {
        code: s.shareCode,
        type: selected,
        message,
        lat: position.lat,
        lng: position.lng,
        userName: user.fullName,
      });
      setDone({ code: s.shareCode, type: selected });
    } catch {
      const code = 'KAA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const socket = getSocket();
      socket.emit('new-request', { code, type: selected, message, lat: position.lat, lng: position.lng });
      setDone({ code, type: selected });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    const t = REQUEST_TYPES.find(r => r.id === done.type)!;
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0F0F0F] px-6 text-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
          <img src={t.icon} alt="" className="w-10 h-10" style={{ filter: t.iconFilter }} />
        </div>
        <div>
          <h2 className="text-2xl font-black">{done.type === 'lost' ? 'Help is coming!' : 'Request sent!'}</h2>
          <p className="text-[#8E8E9A] mt-2 text-sm">Your location has been shared with nearby helpers</p>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-6 py-4 w-full">
          <p className="text-xs text-[#555] mb-1">Share this code</p>
          <p className="text-2xl font-black tracking-widest text-[#A8D83F]">{done.code}</p>
          <p className="text-xs text-[#555] mt-1">Anyone with this code can track your location</p>
        </div>
        <button onClick={() => router.push(`/share`)}
          className="w-full py-4 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold">
          View Live Sharing
        </button>
        <button onClick={() => router.push('/home')}
          className="text-sm text-[#555]">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F]">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-12 pb-4">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
          <img src="/back-arrow.png" alt="" className="w-5 h-5 opacity-70" />
        </button>
        <div>
          <h1 className="text-xl font-black">Request Help</h1>
          <p className="text-xs text-[#555]">Choose what you need</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto sheet-scroll px-5 pb-8">
        {/* Type cards */}
        <div className="space-y-3 mb-6">
          {REQUEST_TYPES.map(t => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${selected === t.id ? t.active : t.bg}`}>
              <div className="w-14 h-14 rounded-2xl bg-[#0F0F0F] flex items-center justify-center flex-shrink-0">
                <img src={t.icon} alt="" className="w-8 h-8" style={{ filter: t.iconFilter }} />
              </div>
              <div>
                <p className={`text-base font-bold ${selected === t.id ? t.color : 'text-white'}`}>{t.label}</p>
                <p className="text-xs text-[#555] mt-0.5">{t.sublabel}</p>
              </div>
              {selected === t.id && (
                <div className="ml-auto w-5 h-5 rounded-full bg-[#A8D83F] flex items-center justify-center flex-shrink-0">
                  <img src="/check.png" alt="" className="w-3 h-3" style={{ filter: 'brightness(0)' }} />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Message */}
        <textarea
          className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555] outline-none resize-none mb-6"
          rows={3}
          placeholder="Describe your situation (optional)"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />

        {/* Location status */}
        <div className={`flex items-center gap-3 p-3 rounded-2xl mb-6 ${position ? 'bg-[#A8D83F]/10 border border-[#A8D83F]/20' : 'bg-[#1A1A1A] border border-[#2A2A2A]'}`}>
          <img src="/target.png" alt="" className="w-5 h-5 opacity-60" />
          <span className="text-xs font-semibold">{position ? `Location ready (±${Math.round(position.accuracy ?? 0)}m)` : 'Getting your location...'}</span>
        </div>

        <button
          onClick={submit}
          disabled={!selected || !position || loading}
          className="w-full py-4 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold disabled:opacity-40"
        >
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  );
}
