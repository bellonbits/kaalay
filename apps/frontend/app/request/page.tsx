'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined, AlertOutlined, CarOutlined, TeamOutlined,
  CheckOutlined, EnvironmentFilled, SendOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { createSession } from '../../lib/api';
import { getSocket } from '../../lib/socket';

const TYPES = [
  {
    id: 'lost',
    Icon: AlertOutlined,
    label: "I'm Lost",
    sub: 'Alert nearby helpers to your location',
    iconBg: '#FEE2E2', iconColor: '#DC2626',
    activeBorder: '#FCA5A5', activeBg: '#FFF5F5',
    pillBg: '#FEE2E2', pillColor: '#DC2626',
  },
  {
    id: 'pickup',
    Icon: CarOutlined,
    label: 'Need a Ride',
    sub: 'Request a driver or helper to pick you up',
    iconBg: '#EDE9FE', iconColor: '#7C3AED',
    activeBorder: '#C4B5FD', activeBg: '#FAF5FF',
    pillBg: '#EDE9FE', pillColor: '#7C3AED',
  },
  {
    id: 'meetup',
    Icon: TeamOutlined,
    label: 'Meet Friends',
    sub: 'Share your location for friends to find you',
    iconBg: '#DCFCE7', iconColor: '#16A34A',
    activeBorder: '#86EFAC', activeBg: '#F0FDF4',
    pillBg: '#DCFCE7', pillColor: '#16A34A',
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
        requestType: sel, visibility: 'public', message: msg || undefined, userId: user.id,
      });
      getSocket().emit('new-request', { code: s.shareCode, type: sel, message: msg, lat: position.lat, lng: position.lng, userName: user.fullName });
      setDone({ code: s.shareCode, type: sel });
    } catch {
      const code = 'KAA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      getSocket().emit('new-request', { code, type: sel, message: msg, lat: position.lat, lng: position.lng });
      setDone({ code, type: sel });
    } finally { setLoading(false); }
  };

  /* ── Done ── */
  if (done) {
    const t = TYPES.find(x => x.id === done.type)!;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
        {/* Yellow header */}
        <div style={{ background: '#FFD600', padding: '56px 24px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase', marginBottom: 10 }}>
            Request sent
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <t.Icon style={{ fontSize: 24, color: '#1A1A1A' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A' }}>{t.label}</h2>
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', fontWeight: 500 }}>Helpers nearby have been notified</p>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Code card */}
          <div style={{ background: '#FFFFFF', borderRadius: 22, padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1.5px solid #EBEBEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <div style={{ width: 1, height: 28, background: '#EBEBEB' }} />
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#888', marginBottom: 1 }}>Your location</p>
                <div style={{ height: 1, background: '#EBEBEB', margin: '8px 0' }} />
                <p style={{ fontSize: 11, color: '#888' }}>Requesting help</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 26, fontWeight: 900, letterSpacing: '3px', color: '#1A1A1A' }}>{done.code}</p>
                <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Share this code</p>
              </div>
            </div>
          </div>

          {/* Steps */}
          {[
            'Helpers nearby can see your request on the map',
            'Share the code above with someone you trust',
            'They can track your live location instantly',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1A1A1A', color: '#FFFFFF', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5, paddingTop: 2 }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push(`/track/${done.code}`)} style={{
            width: '100%', padding: '16px', background: '#1A1A1A', color: '#FFFFFF',
            border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            View my live session
          </button>
          <button onClick={() => router.push('/home')} style={{
            width: '100%', padding: '14px', background: '#F7F7F7', color: '#1A1A1A',
            border: '1.5px solid #EBEBEB', borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            Back to map
          </button>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  const selT = TYPES.find(t => t.id === sel);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 16px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7',
            border: '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Request Help</h1>
            <p style={{ fontSize: 12, color: '#888' }}>What do you need?</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Type cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {TYPES.map(t => {
            const active = sel === t.id;
            return (
              <button key={t.id} onClick={() => setSel(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 16px', borderRadius: 20,
                background: active ? t.activeBg : '#FFFFFF',
                border: `2px solid ${active ? t.activeBorder : '#EBEBEB'}`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <t.Icon style={{ fontSize: 22, color: t.iconColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', marginBottom: 3 }}>{t.label}</p>
                  <p style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{t.sub}</p>
                </div>
                {active && (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckOutlined style={{ fontSize: 11, color: '#FFFFFF' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Message */}
        <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          Message (optional)
        </p>
        <textarea
          style={{
            width: '100%', background: '#FFFFFF', border: '1.5px solid #EBEBEB',
            borderRadius: 14, padding: '14px 16px', fontSize: 14, color: '#1A1A1A',
            resize: 'none', outline: 'none', fontFamily: 'Inter, sans-serif',
            marginBottom: 16, lineHeight: 1.5,
          }}
          rows={3}
          placeholder={sel === 'lost' ? "Where are you? e.g. 'Near the blue gate on Kenyatta Ave'" : "Any details helpers should know…"}
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />

        {/* Location status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 14, padding: '12px 14px',
          background: position ? '#F0FDF4' : '#F7F7F7',
          border: `1.5px solid ${position ? '#86EFAC' : '#EBEBEB'}`,
        }}>
          <EnvironmentFilled style={{ fontSize: 18, color: position ? '#16A34A' : '#BBBBBB' }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
              {position ? 'Location ready' : 'Getting your location…'}
            </p>
            {position && <p style={{ fontSize: 11, color: '#888' }}>±{Math.round(position.accuracy ?? 0)}m accuracy</p>}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ background: '#FFFFFF', borderTop: '1px solid #EBEBEB', padding: '12px 20px 36px', flexShrink: 0 }}>
        {selT && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: selT.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <selT.Icon style={{ fontSize: 14, color: selT.iconColor }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{selT.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: selT.pillBg, color: selT.pillColor }}>
              selected
            </span>
          </div>
        )}
        <button
          onClick={submit}
          disabled={!sel || !position || loading}
          style={{
            width: '100%', padding: '16px', border: 'none', borderRadius: 16,
            background: !sel || !position ? '#EBEBEB' : '#1A1A1A',
            color: !sel || !position ? '#BBBBBB' : '#FFFFFF',
            fontSize: 15, fontWeight: 800, cursor: !sel || !position ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <SendOutlined style={{ fontSize: 14 }} />
          {loading ? 'Sending…' : 'Send Request'}
        </button>
      </div>
    </div>
  );
}
