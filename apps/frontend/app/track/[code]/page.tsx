'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, AlertOutlined, CarOutlined, TeamOutlined,
  EnvironmentOutlined, CheckCircleFilled, CompassOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { useSessionSocket } from '../../../hooks/useSocket';
import { getSessionByCode, convertTo3wa } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type { MarkerData } from '../../../components/MapBase';
import LowDataView from '../../../components/LowDataView';

const MapBase = dynamic(() => import('../../../components/MapBase'), { ssr: false });

interface LivePos { lat: number; lng: number; accuracy?: number; timestamp: number }
interface Session { shareCode: string; requestType: string; message?: string; status: string; user?: { fullName: string } }

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat  * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const TYPE_META: Record<string, { Icon: React.ComponentType<any>; iconBg: string; iconColor: string; label: string }> = {
  lost:    { Icon: AlertOutlined,       iconBg: '#FEE2E2', iconColor: '#DC2626', label: 'Lost' },
  pickup:  { Icon: CarOutlined,         iconBg: '#EDE9FE', iconColor: '#7C3AED', label: 'Pickup' },
  meetup:  { Icon: TeamOutlined,        iconBg: '#DCFCE7', iconColor: '#16A34A', label: 'Meetup' },
  general: { Icon: EnvironmentOutlined, iconBg: '#F3F4F6', iconColor: '#6B7280', label: 'Live' },
};

// ── Enter code view ──────────────────────────────────────────────────────
function EnterCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 16px', borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7',
            border: '1.5px solid #EBEBEB', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Track Someone</h1>
            <p style={{ fontSize: 12, color: '#888' }}>Enter the share code they sent you</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 16 }}>
        {/* Code input card */}
        <div style={{ width: '100%', background: '#FFFFFF', borderRadius: 24, padding: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1.5px solid #EBEBEB' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>Share code</p>
          <input
            style={{
              width: '100%', textAlign: 'center', fontSize: 28, fontWeight: 900,
              letterSpacing: '6px', color: '#1A1A1A', background: '#F7F7F7',
              border: '2px solid #EBEBEB', borderRadius: 16, padding: '16px',
              outline: 'none', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase',
            }}
            placeholder="KAA-XXXX"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
          <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 10 }}>
            Ask the person sharing to give you their code
          </p>
        </div>

        <button
          disabled={code.length < 6}
          onClick={() => router.push(`/track/${code}`)}
          style={{
            width: '100%', padding: '16px',
            background: code.length < 6 ? '#EBEBEB' : '#1A1A1A',
            color: code.length < 6 ? '#BBBBBB' : '#FFFFFF',
            border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800,
            cursor: code.length < 6 ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Track Live Location
        </button>
      </div>
    </div>
  );
}

// ── Live tracker ─────────────────────────────────────────────────────────
function LiveTracker({ code }: { code: string }) {
  const router = useRouter();
  const { position: me } = useGeolocation(false);
  const [tracked,  setTracked]  = useState<LivePos | null>(null);
  const [session,  setSession]  = useState<Session | null>(null);
  const [ended,    setEnded]    = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [user,     setUser]     = useState<{ fullName?: string; id?: string; role?: string }>({});
  const [w3w,      setW3w]      = useState<string | null>(null);
  const [lowData,  setLowData]  = useState(false);
  const isHelper = user.role === 'helper' || user.role === 'driver';

  const [sharingBack, setSharingBack] = useState(false);
  const [arrived,    setArrived]    = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('kaalay_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => { getSessionByCode(code).then(setSession).catch(() => null); }, [code]);

  useEffect(() => {
    if (!tracked) return;
    convertTo3wa(tracked.lat, tracked.lng).then(d => setW3w(d.what3words)).catch(() => null);
  }, [tracked?.lat, tracked?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast own location back to owner if sharingBack is on
  useEffect(() => {
    if (!sharingBack || !me || !code) return;
    const s = getSocket();
    const interval = setInterval(() => {
      s.emit('viewer-location', {
        code, viewerId: user.id || 'anon', name: user.fullName || 'Someone',
        lat: me.lat, lng: me.lng, accuracy: me.accuracy
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [sharingBack, me, code, user.id, user.fullName]);

  useSessionSocket(
    code,
    useCallback((d: LivePos) => setTracked(d), []),
    useCallback((d: { status: string }) => { if (d.status === 'ended') setEnded(true); }, []),
    useCallback((d: { helperName: string }) => setAccepted(d.helperName), []),
    useCallback((d: { count: number }) => setViewerCount(d.count), []),
    useCallback((d: { name: string }) => {
      // In a tracking view, we usually don't care if *others* arrived
    }, []),
  );

  const km  = me && tracked ? dist(me, tracked) : null;
  const eta = km ? Math.round((km / 40) * 60) : null;

  const openMaps = () => tracked && window.open(`https://www.google.com/maps/dir/?api=1&destination=${tracked.lat},${tracked.lng}`, '_blank');
  const accept   = () => {
    getSocket().emit('accept-request', { code, helperName: user.fullName ?? 'Helper', helperId: user.id });
    openMaps();
  };

  const signalArrival = () => {
    getSocket().emit('arrived', { code, name: user.fullName || 'Someone' });
    setArrived(true);
  };

  const markers: MarkerData[] = [
    ...(me      ? [{ lat: me.lat,      lng: me.lng,      type: 'me'      as const, accuracy: me.accuracy }] : []),
    ...(tracked ? [{ lat: tracked.lat, lng: tracked.lng, type: 'tracked' as const }]                        : []),
  ];

  const center  = tracked ?? me ?? { lat: -1.29, lng: 36.82 };
  const typeMeta = TYPE_META[session?.requestType ?? 'general'] ?? TYPE_META.general;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Map or Low Data View */}
      <div style={{ position: 'relative', flex: 1 }}>
        {lowData && tracked ? (
          <LowDataView me={me ?? undefined} target={tracked} w3w={w3w ?? undefined} />
        ) : (
          <MapBase center={center} zoom={15} markers={markers}
            routeTo={isHelper && tracked ? tracked : undefined}
            className="w-full h-full" />
        )}

        {/* Low Data Toggle */}
        <button onClick={() => setLowData(!lowData)} style={{
          position: 'absolute', top: 48, right: 16, zIndex: 20,
          background: lowData ? '#1A1A1A' : '#FFFFFF', color: lowData ? '#FFFFFF' : '#1A1A1A',
          padding: '8px 12px', borderRadius: 50, border: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)', cursor: 'pointer',
          fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'Inter, sans-serif',
        }}>
          <GlobalOutlined style={{ fontSize: 13 }} />
          {lowData ? 'Map View' : 'Low Data'}
        </button>

        {/* Back */}
        <button onClick={() => router.back()} style={{
          position: 'absolute', top: 48, left: 16, zIndex: 20,
          width: 40, height: 40, borderRadius: '50%',
          background: '#FFFFFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}>
          <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
        </button>

        {/* Code pill */}
        <div style={{ position: 'absolute', top: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: 50, padding: '6px 16px', border: '1px solid #EBEBEB',
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '3px', color: '#1A1A1A' }}>{code}</span>
          </div>
        </div>

        {/* ETA pill */}
        {km !== null && !ended && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: '#FFD600', borderRadius: 20, padding: '8px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            animation: 'bounce-in 0.4s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <typeMeta.Icon style={{ fontSize: 14, color: '#1A1A1A' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
              To location&nbsp;
              <span style={{ fontWeight: 900 }}>{eta} min</span>
            </p>
          </div>
        )}

        {/* Session ended overlay */}
        {ended && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: '#F7F7F7', border: '1.5px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EnvironmentOutlined style={{ fontSize: 32, color: '#BBBBBB' }} />
            </div>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Session ended</p>
            <p style={{ fontSize: 13, color: '#888' }}>This location share has stopped</p>
            <button onClick={() => router.push('/home')} style={{
              padding: '14px 32px', background: '#1A1A1A', color: '#FFFFFF',
              border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Go home
            </button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px 40px', boxShadow: '0 -4px 32px rgba(0,0,0,0.10)' }}>
        {/* Accepted banner */}
        {accepted && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#F0FDF4', borderRadius: 16, padding: '12px 14px',
            border: '1.5px solid #86EFAC', marginBottom: 14,
          }}>
            <CheckCircleFilled style={{ fontSize: 22, color: '#16A34A', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>Help is on the way</p>
              <p style={{ fontSize: 12, color: '#16A34A' }}>{accepted} accepted your request</p>
            </div>
          </div>
        )}

        {/* w3w + compass card */}
        {tracked && (
          <div style={{
            background: '#1A1A1A', borderRadius: 20, padding: '14px 16px',
            marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4 }}>Precise location</p>
              {w3w ? (
                <p style={{ fontSize: 15, fontWeight: 900, color: '#FFD600', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ///{w3w}
                </p>
              ) : (
                <div style={{ height: 18, width: 140, background: '#333', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
              )}
              {km !== null && (
                <p style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                  {km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`}
                </p>
              )}
            </div>
            {/* Compass */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: '1.5px solid #333', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', background: '#111',
            }}>
              <span style={{ position: 'absolute', top: 3, fontSize: 8, fontWeight: 700, color: '#555', letterSpacing: 0 }}>N</span>
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: '18px solid #FFD600',
                transform: `rotate(${me && tracked ? bearing(me, tracked) : 0}deg)`,
                transformOrigin: '50% 75%',
                transition: 'transform 0.5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Route row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F7F7F7', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #EBEBEB', marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            <div style={{ width: 1, height: 16, background: '#EBEBEB' }} />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: '#888' }}>My location</p>
            <div style={{ height: 1, background: '#EBEBEB', margin: '6px 0' }} />
            <p style={{ fontSize: 12, color: '#888' }}>{session?.user?.fullName ?? 'Someone'}</p>
          </div>
          {km !== null && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>
                {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
              </p>
              {eta && <p style={{ fontSize: 11, color: '#888' }}>~{eta} min</p>}
            </div>
          )}
        </div>

        {/* Type badge */}
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: typeMeta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <typeMeta.Icon style={{ fontSize: 13, color: typeMeta.iconColor }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{typeMeta.label}</span>
            {session.message && (
              <span style={{ fontSize: 12, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {session.message}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button onClick={openMaps} style={{
            flex: 1, padding: '14px', background: '#F7F7F7', color: '#1A1A1A',
            border: '1.5px solid #EBEBEB', borderRadius: 16, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Inter, sans-serif',
          }}>
            <CompassOutlined style={{ fontSize: 15 }} />
            Navigate
          </button>
          {isHelper ? (
            <button onClick={accept} style={{
              flex: 1, padding: '14px', background: '#1A1A1A', color: '#FFFFFF',
              border: 'none', borderRadius: 16, fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Accept request
            </button>
          ) : (
            <button onClick={signalArrival} disabled={arrived} style={{
              flex: 1, padding: '14px', background: arrived ? '#F0FDF4' : '#1A1A1A', color: arrived ? '#16A34A' : '#FFFFFF',
              border: arrived ? '1.5px solid #86EFAC' : 'none', borderRadius: 16, fontSize: 13, fontWeight: 800,
              cursor: arrived ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              {arrived ? <CheckCircleFilled style={{ fontSize: 14 }} /> : <TeamOutlined style={{ fontSize: 14 }} />}
              {arrived ? 'Arrived!' : "I've arrived"}
            </button>
          )}
        </div>

        {/* Coordination toggle */}
        {!isHelper && (
          <button 
            onClick={() => setSharingBack(!sharingBack)}
            style={{
              width: '100%', padding: '12px', background: sharingBack ? '#1A1A1A' : '#F7F7F7',
              color: sharingBack ? '#FFFFFF' : '#888', border: '1.5px solid #EBEBEB',
              borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: sharingBack ? '#22C55E' : '#CCC' }} />
            {sharingBack ? 'Sharing my location back' : 'Share my location back'}
          </button>
        )}
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
