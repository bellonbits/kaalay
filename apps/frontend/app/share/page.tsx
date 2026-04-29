'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';
import {
  ArrowLeftOutlined, EnvironmentOutlined, TeamOutlined, CarOutlined,
  AlertOutlined, LockOutlined, GlobalOutlined, CopyOutlined, CheckOutlined,
  StopOutlined, ClockCircleOutlined, ShareAltOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { createSession, updateSessionStatus, convertTo3wa } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

const TYPES = [
  { id: 'general', label: 'Share Location', sub: 'Let others see where you are',  Icon: EnvironmentOutlined, iconBg: '#F3F4F6', iconColor: '#6B7280', activeBg: '#1A1A1A', activeText: '#FFFFFF' },
  { id: 'meetup',  label: 'Meet Friends',   sub: 'Invite friends to find you',    Icon: TeamOutlined,        iconBg: '#DCFCE7', iconColor: '#16A34A', activeBg: '#1A1A1A', activeText: '#FFFFFF' },
  { id: 'pickup',  label: 'Need Pickup',    sub: 'Ask a driver to come to you',   Icon: CarOutlined,         iconBg: '#EDE9FE', iconColor: '#7C3AED', activeBg: '#1A1A1A', activeText: '#FFFFFF' },
  { id: 'lost',    label: "I'm Lost",       sub: 'Alert the community to help',   Icon: AlertOutlined,       iconBg: '#FEE2E2', iconColor: '#DC2626', activeBg: '#1A1A1A', activeText: '#FFFFFF' },
];

const DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '1 hr',   ms: 60 * 60 * 1000 },
  { label: '4 hrs',  ms: 4 * 60 * 60 * 1000 },
  { label: '∞',      ms: 0 },
];

export default function SharePage() {
  const router        = useRouter();
  const { position }  = useGeolocation(true);
  const socketRef     = useSocket();
  const broadRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step,    setStep]    = useState<'setup' | 'live'>('setup');
  const [type,    setType]    = useState('general');
  const [dur,     setDur]     = useState(0);
  const [msg,     setMsg]     = useState('');
  const [session, setSession] = useState<{ shareCode: string } | null>(null);
  const [qr,      setQr]      = useState('');
  const [copied,  setCopied]  = useState(false);
  const [vis,     setVis]     = useState<'link' | 'public'>('link');
  const [w3w,     setW3w]     = useState<string | null>(null);
  const [msgCopied, setMsgCopied] = useState(false);


  const [viewerCount, setViewerCount] = useState(0);
  const [viewers,     setViewers]     = useState<Record<string, { lat: number; lng: number; name: string; timestamp: number }>>({});
  const [arrivals,    setArrivals]    = useState<{ name: string; timestamp: number }[]>([]);

  useEffect(() => {
    if (!session) return;
    const url = `${window.location.origin}/track/${session.shareCode}`;
    QRCode.toDataURL(url, { width: 180, margin: 1 }).then(setQr).catch(() => null);
  }, [session]);

  // Fetch what3words address for current position when live
  useEffect(() => {
    if (step !== 'live' || !position) return;
    convertTo3wa(position.lat, position.lng).then(d => setW3w(d.what3words)).catch(() => null);
  }, [step, position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'live' || !session || !position) return;
    const s = socketRef.current;
    if (!s) return;
    
    s.emit('join', session.shareCode);
    s.emit('new-request', {
      code: session.shareCode, type, message: msg,
      lat: position.lat, lng: position.lng,
      userName: JSON.parse(localStorage.getItem('kaalay_user') ?? '{}').fullName,
    });

    const onViewerCount = (d: { count: number }) => setViewerCount(d.count);
    const onViewerLoc   = (d: { viewerId: string; lat: number; lng: number; name: string; timestamp: number }) => {
      setViewers(prev => ({ ...prev, [d.viewerId]: d }));
    };
    const onArrived     = (d: { name: string; timestamp: number }) => {
      setArrivals(prev => [d, ...prev].slice(0, 5));
      // Could add a toast here
    };

    s.on('viewer-count',    onViewerCount);
    s.on('viewer-location', onViewerLoc);
    s.on('member-arrived',  onArrived);

    broadRef.current = setInterval(() => {
      socketRef.current?.emit('push-location', {
        code: session.shareCode, lat: position.lat, lng: position.lng,
        accuracy: position.accuracy, heading: position.heading, timestamp: Date.now(),
      });
    }, 3000);

    return () => {
      if (broadRef.current) clearInterval(broadRef.current);
      s.off('viewer-count',    onViewerCount);
      s.off('viewer-location', onViewerLoc);
      s.off('member-arrived',  onArrived);
    };
  }, [step, session, position]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!position) return;
    const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
    try {
      const s = await createSession({
        latitude: position.lat, longitude: position.lng, accuracy: position.accuracy,
        requestType: type, visibility: vis,
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

  const copy = () => {
    navigator.clipboard.writeText(session!.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl   = () => `${window.location.origin}/track/${session!.shareCode}`;
  const shareText  = () => {
    const w = w3w ? `///${w3w}` : session!.shareCode;
    return `Find me at ${w}\n\nTrack my live location:\n${shareUrl()}\n\nSent via Kaalay`;
  };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank');
  const shareSMS      = () => window.open(`sms:?body=${encodeURIComponent(shareText())}`, '_blank');
  const copyMessage   = () => {
    navigator.clipboard.writeText(shareText());
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...Object.values(viewers).map(v => ({ lat: v.lat, lng: v.lng, type: 'tracked' as const, label: v.name })),
  ];

  const selT = TYPES.find(t => t.id === type)!;


  /* ── LIVE VIEW ── */
  if (step === 'live' && session) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />

        {/* Viewer count pill */}
        <div style={{ position: 'absolute', top: 48, right: 16, zIndex: 20 }}>
          <div style={{
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: 50, padding: '8px 16px', border: '1.5px solid #EBEBEB',
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <TeamOutlined style={{ fontSize: 14, color: viewerCount > 0 ? '#16A34A' : '#888' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A' }}>
              {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
            </span>
          </div>
        </div>

        {/* Arrival notifications */}
        <div style={{ position: 'absolute', top: 100, left: 16, right: 16, zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {arrivals.map((a, i) => (
            <div key={`${a.name}-${a.timestamp}`} style={{
              background: '#F0FDF4', borderRadius: 16, padding: '10px 16px',
              border: '1.5px solid #86EFAC', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'slide-in-right 0.4s cubic-bezier(.34,1.56,.64,1) both',
              opacity: Math.max(0, 1 - (Date.now() - a.timestamp) / 10000), // Fade out after 10s
            }}>
              <CheckCircleFilled style={{ fontSize: 18, color: '#16A34A' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>{a.name} has arrived!</p>
            </div>
          ))}
        </div>

        {/* Yellow banner */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#FFD600', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <selT.Icon style={{ fontSize: 18, color: '#1A1A1A' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{selT.label}</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Broadcasting your live location</p>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A1A1A', animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
        </div>
      </div>

      {/* Code card */}
      <div style={{ background: '#FFFFFF', padding: '20px 20px 40px', boxShadow: '0 -4px 32px rgba(0,0,0,0.10)' }}>
        {/* Route row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F7F7F7', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #EBEBEB', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            <div style={{ width: 1, height: 20, background: '#EBEBEB' }} />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: '#888' }}>From</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>My location</p>
            <div style={{ height: 1, background: '#EBEBEB', margin: '6px 0' }} />
            <p style={{ fontSize: 12, color: '#888' }}>Sharing as</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{selT.label}</p>
          </div>
        </div>

        {/* Code + QR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Share code</p>
            <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: '4px', color: '#1A1A1A' }}>{session.shareCode}</p>
            <button onClick={copy} style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: copied ? '#16A34A' : '#888',
              background: copied ? '#F0FDF4' : '#F7F7F7',
              border: `1.5px solid ${copied ? '#86EFAC' : '#EBEBEB'}`,
              borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              {copied ? <CheckOutlined style={{ fontSize: 12 }} /> : <CopyOutlined style={{ fontSize: 12 }} />}
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>
          {qr && (
            <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', border: '2px solid #EBEBEB', flexShrink: 0 }}>
              <img src={qr} alt="QR" style={{ width: '100%', height: '100%' }} />
            </div>
          )}
        </div>

        {/* what3words address */}
        {w3w && (
          <div style={{ background: '#1A1A1A', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>
              Your exact location
            </p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#FFD600', letterSpacing: '1px', marginBottom: 2 }}>
              ///{w3w}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>powered by what3words</p>
          </div>
        )}

        {/* Share buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <button onClick={shareWhatsApp} style={{
            padding: '12px 6px', background: '#25D366', color: '#FFFFFF',
            border: 'none', borderRadius: 14, fontSize: 12, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            WhatsApp
          </button>
          <button onClick={shareSMS} style={{
            padding: '12px 6px', background: '#007AFF', color: '#FFFFFF',
            border: 'none', borderRadius: 14, fontSize: 12, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            SMS
          </button>
          <button onClick={copyMessage} style={{
            padding: '12px 6px',
            background: msgCopied ? '#F0FDF4' : '#F7F7F7',
            color: msgCopied ? '#16A34A' : '#1A1A1A',
            border: `1.5px solid ${msgCopied ? '#86EFAC' : '#EBEBEB'}`,
            borderRadius: 14, fontSize: 12, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {msgCopied ? 'Copied!' : 'Copy msg'}
          </button>
        </div>

        <button onClick={stop} style={{
          width: '100%', padding: '14px', background: '#FFF5F5', color: '#DC2626',
          border: '1.5px solid #FCA5A5', borderRadius: 16, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'Inter, sans-serif',
        }}>
          <StopOutlined style={{ fontSize: 14 }} />
          Stop sharing
        </button>
      </div>
    </div>
  );

  /* ── SETUP VIEW ── */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Map preview */}
      <div style={{ position: 'relative', height: 200, flexShrink: 0 }}>
        <MapBase center={position ?? { lat: -1.29, lng: 36.82 }} zoom={15} markers={markers} className="w-full h-full" />

        {/* Back button */}
        <button onClick={() => router.back()} style={{
          position: 'absolute', top: 48, left: 16,
          width: 40, height: 40, borderRadius: '50%',
          background: '#FFFFFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        }}>
          <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
        </button>

        {/* Yellow banner */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#FFD600', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <selT.Icon style={{ fontSize: 16, color: '#1A1A1A' }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', flex: 1 }}>{selT.label}</p>
          {position && (
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.5)' }}>
              ±{Math.round(position.accuracy ?? 0)}m
            </p>
          )}
        </div>
      </div>

      {/* Setup form */}
      <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '28px 28px 0 0', overflowY: 'auto', padding: '24px 20px 40px', marginTop: -1, boxShadow: '0 -4px 32px rgba(0,0,0,0.08)' }}>

        {/* Type selector */}
        <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>Session type</p>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {TYPES.map(t => {
            const active = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                flexShrink: 0, width: 128, padding: '16px 14px',
                borderRadius: 20, border: `2px solid ${active ? '#1A1A1A' : '#EBEBEB'}`,
                background: active ? '#1A1A1A' : '#F7F7F7',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.10)' : t.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <t.Icon style={{ fontSize: 16, color: active ? '#FFFFFF' : t.iconColor }} />
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: active ? '#FFFFFF' : '#1A1A1A', marginBottom: 3, lineHeight: 1.3 }}>{t.label}</p>
                <p style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.55)' : '#999', lineHeight: 1.4 }}>{t.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Route row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F7F7F7', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #EBEBEB', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            <div style={{ width: 1, height: 16, background: '#EBEBEB' }} />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>My location</p>
            <div style={{ height: 1, background: '#EBEBEB', margin: '6px 0' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>{selT.label} session</p>
          </div>
        </div>

        {/* Message */}
        <textarea
          style={{
            width: '100%', background: '#F7F7F7', border: '1.5px solid #EBEBEB',
            borderRadius: 14, padding: '14px 16px', fontSize: 14, color: '#1A1A1A',
            resize: 'none', outline: 'none', fontFamily: 'Inter, sans-serif',
            marginBottom: 16, lineHeight: 1.5,
          }}
          rows={2}
          placeholder="Add a note (optional) — e.g. 'I'm at the blue gate'"
          value={msg}
          onChange={e => setMsg(e.target.value)}
        />

        {/* Duration */}
        <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Duration</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {DURATIONS.map(d => (
            <button key={d.ms} onClick={() => setDur(d.ms)} style={{
              flex: 1, padding: '10px 4px',
              borderRadius: 12, fontSize: 12, fontWeight: 700,
              border: `1.5px solid ${dur === d.ms ? '#1A1A1A' : '#EBEBEB'}`,
              background: dur === d.ms ? '#1A1A1A' : '#F7F7F7',
              color: dur === d.ms ? '#FFFFFF' : '#888',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              {d.ms > 0 && <ClockCircleOutlined style={{ fontSize: 11 }} />}
              {d.label}
            </button>
          ))}
        </div>

        {/* Visibility */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {([
            { id: 'link' as const,   Icon: LockOutlined,   label: 'Private link' },
            { id: 'public' as const, Icon: GlobalOutlined,  label: 'Public' },
          ]).map(v => (
            <button key={v.id} onClick={() => setVis(v.id)} style={{
              flex: 1, padding: '12px 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              border: `1.5px solid ${vis === v.id ? '#1A1A1A' : '#EBEBEB'}`,
              background: vis === v.id ? '#1A1A1A' : '#F7F7F7',
              color: vis === v.id ? '#FFFFFF' : '#888',
            }}>
              <v.Icon style={{ fontSize: 14 }} />
              {v.label}
            </button>
          ))}
        </div>

        <button onClick={start} disabled={!position} style={{
          width: '100%', padding: '16px',
          background: !position ? '#EBEBEB' : '#1A1A1A',
          color: !position ? '#BBBBBB' : '#FFFFFF',
          border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800,
          cursor: !position ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'Inter, sans-serif',
        }}>
          <ShareAltOutlined style={{ fontSize: 15 }} />
          {position ? 'Share Now' : 'Getting location…'}
        </button>
      </div>
    </div>
  );
}
