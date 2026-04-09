'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  MenuOutlined, BellOutlined, ShareAltOutlined,
  AlertOutlined, SearchOutlined, TeamOutlined, CarOutlined,
  EnvironmentOutlined, RadarChartOutlined, UserOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getPublicSessions } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface Session {
  id: string; shareCode: string; latitude: number; longitude: number;
  requestType: string; message?: string; user?: { fullName: string };
}

const TYPE_META: Record<string, { bg: string; text: string; label: string; Icon: React.ComponentType<any> }> = {
  lost:    { bg: '#FEE2E2', text: '#DC2626', label: 'Lost',    Icon: AlertOutlined },
  pickup:  { bg: '#EDE9FE', text: '#7C3AED', label: 'Pickup',  Icon: CarOutlined },
  meetup:  { bg: '#DCFCE7', text: '#16A34A', label: 'Meetup',  Icon: TeamOutlined },
  general: { bg: '#F3F4F6', text: '#6B7280', label: 'Live',    Icon: EnvironmentOutlined },
};

const CAR_OFFSETS = [
  { dlat: 0.012, dlng: -0.018 }, { dlat: -0.009, dlng: 0.022 },
  { dlat: 0.020, dlng: 0.011 },  { dlat: -0.016, dlng: -0.014 },
  { dlat: 0.007, dlng: 0.028 },
];

export default function HomePage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const [mounted,  setMounted]  = useState(false);
  const [user,     setUser]     = useState<{ fullName: string; role: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetH,   setSheetH]   = useState<'peek' | 'half' | 'full'>('peek');
  const [search,   setSearch]   = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    setUser(JSON.parse(u));
    getPublicSessions().then(setSessions).catch(() => null);
  }, [router]);

  const center    = position ?? { lat: -1.2921, lng: 36.8219 };
  const isHelper  = user?.role === 'helper' || user?.role === 'driver';

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...CAR_OFFSETS.map(o => ({ lat: center.lat + o.dlat, lng: center.lng + o.dlng, type: 'car' as const })),
    ...sessions.slice(0, 4).map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude), type: 'request' as const, label: s.user?.fullName })),
  ];

  if (!mounted) return <div style={{ height: '100%', background: '#F7F7F7' }} />;

  const sheetTranslate = sheetH === 'peek' ? 'calc(100% - 148px)' : sheetH === 'half' ? 'calc(100% - 380px)' : '0px';

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (search.trim()) router.push('/share'); };

  const QUICK = [
    { label: 'Share',    Icon: ShareAltOutlined, href: '/share',       bg: '#FFD600', color: '#1A1A1A' },
    { label: 'Help',     Icon: AlertOutlined,    href: '/request',     bg: '#1A1A1A', color: '#FFFFFF' },
    { label: 'Track',    Icon: RadarChartOutlined, href: '/track/enter', bg: '#F7F7F7', color: '#1A1A1A', border: true },
    { label: isHelper ? 'Requests' : 'Meet', Icon: isHelper ? CarOutlined : TeamOutlined,
      href: isHelper ? '/driver' : '/share',  bg: '#F7F7F7', color: '#1A1A1A', border: true },
  ];

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#F7F7F7' }}>

      {/* Full-screen map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapBase center={center} zoom={14} markers={markers} className="w-full h-full" />
      </div>

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '48px 16px 12px',
        pointerEvents: 'none',
      }}>
        <button onClick={() => router.push('/auth')} style={{
          pointerEvents: 'auto',
          width: 44, height: 44, borderRadius: '50%',
          background: '#FFFFFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}>
          <MenuOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
        </button>

        {position && (
          <div style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#1A1A1A', borderRadius: 50,
            padding: '8px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
            animation: 'bounce-in 0.4s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFD600', animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
            <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700 }}>
              Live · {sessions.length} nearby
            </span>
          </div>
        )}

        <button onClick={() => router.push(isHelper ? '/driver' : '/share')} style={{
          pointerEvents: 'auto',
          width: 44, height: 44, borderRadius: '50%',
          background: '#FFFFFF', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}>
          <BellOutlined style={{ fontSize: 17, color: '#1A1A1A' }} />
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        height: '84%',
        background: '#FFFFFF',
        borderRadius: '28px 28px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.10)',
        transform: `translateY(${sheetTranslate})`,
        transition: 'transform 0.35s cubic-bezier(.22,.68,0,1.1)',
      }}>
        {/* Handle */}
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', cursor: 'pointer' }}
          onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#EBEBEB' }} />
        </div>

        <div style={{ padding: '4px 20px 0' }}>
          {/* Greeting */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: '#888', fontWeight: 500, marginBottom: 2 }}>Good time to connect</p>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {user?.fullName?.split(' ')[0] ?? 'Hey'}
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: '#FFD600' }}>
                  <UserOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
                </span>
              </h2>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#F7F7F7', border: '1.5px solid #EBEBEB',
              borderRadius: 50, padding: '6px 12px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>Now</span>
              <span style={{ color: '#888', fontSize: 11 }}>↓</span>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: 20 }}>
            <SearchOutlined style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: '#BBBBBB',
            }} />
            <input
              style={{
                width: '100%', background: '#F7F7F7',
                border: '1.5px solid #EBEBEB', borderRadius: 14,
                padding: '14px 16px 14px 44px',
                fontSize: 15, fontWeight: 500, color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
              placeholder="Where are you going?"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSheetH('half')}
            />
          </form>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => router.push(q.href)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 8px', borderRadius: 18,
                background: q.bg, color: q.color,
                border: q.border ? '1.5px solid #EBEBEB' : 'none',
                cursor: 'pointer',
              }}>
                <q.Icon style={{ fontSize: 18 }} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Nearby */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>Nearby activity</p>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{sessions.length} live</span>
          </div>

          {sessions.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#F7F7F7', border: '1.5px solid #EBEBEB',
              borderRadius: 16, padding: '14px 16px',
            }}>
              <EnvironmentOutlined style={{ fontSize: 22, color: '#BBBBBB' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>All quiet nearby</p>
                <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Be the first to share your location</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {sessions.map(s => {
                const m = TYPE_META[s.requestType] ?? TYPE_META.general;
                return (
                  <button key={s.id} onClick={() => router.push(`/track/${s.shareCode}`)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#F7F7F7', border: '1.5px solid #EBEBEB',
                    borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <m.Icon style={{ fontSize: 16, color: m.text }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.user?.fullName ?? 'Someone'}
                      </p>
                      <p style={{ fontSize: 11, color: '#888', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.message ?? 'Live location'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                      borderRadius: 20, background: m.bg, color: m.text, flexShrink: 0,
                    }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
