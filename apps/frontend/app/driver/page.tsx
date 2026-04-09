'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, AlertOutlined, CarOutlined, TeamOutlined,
  EnvironmentOutlined, UnorderedListOutlined, GlobalOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { getPublicSessions } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface Req { code: string; type: string; message?: string; lat: number; lng: number; userName?: string; timestamp?: number }

const TYPE_META: Record<string, { Icon: React.ComponentType<any>; label: string; iconBg: string; iconColor: string; pillBg: string; pillColor: string }> = {
  lost:    { Icon: AlertOutlined,       label: 'Lost Person',  iconBg: '#FEE2E2', iconColor: '#DC2626', pillBg: '#FEE2E2', pillColor: '#DC2626' },
  pickup:  { Icon: CarOutlined,         label: 'Needs Pickup', iconBg: '#EDE9FE', iconColor: '#7C3AED', pillBg: '#EDE9FE', pillColor: '#7C3AED' },
  meetup:  { Icon: TeamOutlined,        label: 'Meet Friends', iconBg: '#DCFCE7', iconColor: '#16A34A', pillBg: '#DCFCE7', pillColor: '#16A34A' },
  general: { Icon: EnvironmentOutlined, label: 'Live Share',   iconBg: '#F3F4F6', iconColor: '#6B7280', pillBg: '#F3F4F6', pillColor: '#6B7280' },
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dL = (b.lat - a.lat) * Math.PI / 180, dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function DriverPage() {
  const router = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();
  const [mounted, setMounted] = useState(false);
  const [reqs,   setReqs]   = useState<Req[]>([]);
  const [online, setOnline] = useState(false);
  const [tab,    setTab]    = useState<'map' | 'list'>('map');
  const [user,   setUser]   = useState<{ fullName?: string; id?: string }>({});

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('kaalay_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    getPublicSessions().then((ss: any[]) =>
      setReqs(ss.map(s => ({ code: s.shareCode, type: s.requestType, message: s.message, lat: Number(s.latitude), lng: Number(s.longitude), userName: s.user?.fullName, timestamp: new Date(s.createdAt).getTime() })))
    ).catch(() => null);
  }, []);

  const onReq = useCallback((r: Req) => setReqs(p => p.some(x => x.code === r.code) ? p : [r, ...p]), []);

  useEffect(() => {
    const s = socketRef.current; if (!s || !online) return;
    s.emit('watch-requests'); s.on('request', onReq);
    return () => { s.off('request', onReq); };
  }, [online, onReq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!position || !online || !socketRef.current) return;
    socketRef.current.emit('driver:update_location', { driverId: user.id, lat: position.lat, lng: position.lng });
  }, [position, online]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return <div style={{ height: '100%', background: '#F7F7F7' }} />;

  const center = position ?? { lat: -1.2921, lng: 36.8219 };
  const sorted = [...reqs].sort((a, b) => position ? distKm(position, a) - distKm(position, b) : 0);
  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...reqs.map(r => ({ lat: r.lat, lng: r.lng, type: 'request' as const, label: r.userName })),
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>

      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 12px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/home')} style={{ width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7', border: '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Helper Dashboard</h1>
              <p style={{ fontSize: 12, color: '#888' }}>{user.fullName ?? 'Driver'}</p>
            </div>
          </div>

          {/* Online toggle */}
          <button onClick={() => setOnline(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 50,
            background: online ? '#F0FDF4' : '#F7F7F7',
            border: `2px solid ${online ? '#86EFAC' : '#EBEBEB'}`,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            <PoweroffOutlined style={{ fontSize: 13, color: online ? '#16A34A' : '#BBBBBB' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: online ? '#16A34A' : '#888' }}>
              {online ? 'Online' : 'Go online'}
            </span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#22C55E' : '#DDD', ...(online ? { animation: 'pulse-dot 1.6s ease-in-out infinite' } : {}) }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#F7F7F7', border: '1.5px solid #EBEBEB', borderRadius: 14, padding: 4 }}>
          {([
            { id: 'map',  Icon: GlobalOutlined,        label: 'Map view' },
            { id: 'list', Icon: UnorderedListOutlined, label: `Requests (${sorted.length})` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#1A1A1A' : 'transparent',
              color: tab === t.id ? '#FFFFFF' : '#888',
              fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s',
            }}>
              <t.Icon style={{ fontSize: 13 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Map tab ── */}
      {tab === 'map' && (
        <div style={{ flex: 1, position: 'relative' }}>
          <MapBase center={center} zoom={13} markers={markers} className="w-full h-full" />

          {!online && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: '#F7F7F7', border: '2px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CarOutlined style={{ fontSize: 28, color: '#BBBBBB' }} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Go online to see requests</p>
              <p style={{ fontSize: 14, color: '#888', lineHeight: 1.5 }}>People nearby need help — tap Go online to start receiving requests</p>
              <button onClick={() => setOnline(true)} style={{ padding: '15px 32px', background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Go Online Now
              </button>
            </div>
          )}

          {online && (
            <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ background: '#FFD600', borderRadius: 50, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A1A1A', animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>{sorted.length} request{sorted.length !== 1 ? 's' : ''} nearby</span>
              </div>
            </div>
          )}

          {/* Mini cards */}
          {online && sorted.slice(0, 2).map(r => {
            const m = TYPE_META[r.type] ?? TYPE_META.general;
            const d = position ? distKm(position, r) : null;
            return (
              <button key={r.code} onClick={() => router.push(`/track/${r.code}`)}
                style={{
                  position: 'absolute', bottom: sorted.length > 1 ? (sorted.indexOf(r) === 0 ? 88 : 20) : 20,
                  left: 16, right: 16,
                  background: '#FFFFFF', borderRadius: 18, padding: '12px 14px',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.10)', border: '1.5px solid #EBEBEB',
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <m.Icon style={{ fontSize: 18, color: m.iconColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.userName ?? 'Anonymous'}</p>
                  <p style={{ fontSize: 11, color: '#888' }}>{m.label}</p>
                </div>
                {d !== null && <p style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', flexShrink: 0 }}>{d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}</p>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── List tab ── */}
      {tab === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!online ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '0 32px' }}>
              <PoweroffOutlined style={{ fontSize: 40, color: '#BBBBBB' }} />
              <p style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>You're offline</p>
              <p style={{ fontSize: 14, color: '#888' }}>Go online to see and accept nearby requests</p>
              <button onClick={() => setOnline(true)} style={{ padding: '14px 32px', background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Go Online</button>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <EnvironmentOutlined style={{ fontSize: 36, color: '#BBBBBB' }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>No requests yet</p>
              <p style={{ fontSize: 13, color: '#888' }}>Requests appear here in real time</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sorted.map(r => {
                const m = TYPE_META[r.type] ?? TYPE_META.general;
                const d = position ? distKm(position, r) : null;
                const eta = d ? Math.round((d / 40) * 60) : null;
                return (
                  <div key={r.code} style={{ background: '#FFFFFF', borderRadius: 22, border: '1.5px solid #EBEBEB', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                    {/* Yellow ETA bar */}
                    <div style={{ background: '#FFD600', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <m.Icon style={{ fontSize: 15, color: '#1A1A1A' }} />
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', flex: 1 }}>
                        To this location&nbsp;<span style={{ fontWeight: 900 }}>{eta} min</span>
                      </p>
                      {d !== null && <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.5)' }}>{d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`}</p>}
                    </div>

                    <div style={{ padding: 16 }}>
                      {/* Route row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F7F7F7', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #EBEBEB' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
                          <div style={{ width: 1, height: 14, background: '#DDD' }} />
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: '#1A1A1A' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, color: '#888' }}>My location</p>
                          <div style={{ height: 1, background: '#EBEBEB', margin: '6px 0' }} />
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{r.userName ?? 'Anonymous'}</p>
                        </div>
                      </div>

                      {r.message && (
                        <p style={{ fontSize: 12, color: '#666', background: '#F9F9F9', border: '1px solid #EBEBEB', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontStyle: 'italic' }}>
                          "{r.message}"
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: m.pillBg, color: m.pillColor }}>
                          {m.label}
                        </span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => router.push(`/track/${r.code}`)} style={{
                          padding: '10px 20px', background: '#1A1A1A', color: '#FFFFFF',
                          border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        }}>
                          View &amp; Accept
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
