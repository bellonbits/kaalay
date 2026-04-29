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
  const [reqs,   setReqs]   = useState<Req[]>([]);
  const [online, setOnline] = useState(false);
  const [tab,    setTab]    = useState<'map' | 'list'>('map');
  const [user,   setUser]   = useState<{ fullName?: string; id?: string }>({});

  const [incomingRide, setIncomingRide] = useState<any>(null);
  const [activeRide,   setActiveRide]   = useState<any>(null);

  useEffect(() => {
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
    s.emit('driver:online', { driverId: user.id });
    s.emit('watch-requests');
    s.on('request', onReq);
    
    const onNewRide = (ride: any) => {
      setIncomingRide(ride);
    };
    const onRideTaken = ({ rideId }: { rideId: string }) => {
      if (incomingRide?.rideId === rideId) setIncomingRide(null);
    };

    s.on('ride:new', onNewRide);
    s.on('ride:taken', onRideTaken);

    return () => {
      s.emit('driver:offline', { driverId: user.id });
      s.off('request', onReq);
      s.off('ride:new', onNewRide);
      s.off('ride:taken', onRideTaken);
    };
  }, [online, onReq, user.id, incomingRide?.rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!position || !online || !socketRef.current) return;
    socketRef.current.emit('driver:update_location', { driverId: user.id, lat: position.lat, lng: position.lng });
    
    if (activeRide) {
      socketRef.current.emit('ride:driver_location', { rideId: activeRide.rideId, lat: position.lat, lng: position.lng, heading: position.heading });
    }
  }, [position, online, activeRide, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptRide = () => {
    if (!incomingRide || !socketRef.current) return;
    socketRef.current.emit('ride:accept', {
      rideId: incomingRide.rideId,
      driverId: user.id,
      driverName: user.fullName || 'Driver',
      vehicleModel: 'Toyota Vitz',
      vehicleColor: 'White',
      licensePlate: 'KAA 123X',
    });
    setActiveRide(incomingRide);
    setIncomingRide(null);
    setTab('map');
  };

  const center = position ?? { lat: -1.2921, lng: 36.8219 };
  const sorted = [...reqs].sort((a, b) => position ? distKm(position, a) - distKm(position, b) : 0);
  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...reqs.map(r => ({ lat: r.lat, lng: r.lng, type: 'request' as const, label: r.userName })),
    ...(activeRide ? [{ lat: activeRide.pickupLat, lng: activeRide.pickupLng, type: 'request' as const, label: 'Pickup' }] : []),
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7', position: 'relative', overflow: 'hidden' }}>
      
      {incomingRide && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', padding: '16px'
        }}>
          <div style={{
            width: '100%', background: '#FFFFFF', borderRadius: 28, padding: 24,
            boxShadow: '0 -8px 40px rgba(0,0,0,0.2)', animation: 'ride-slide-up 0.4s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ background: '#FFD600', padding: '6px 12px', borderRadius: 50, fontWeight: 900, fontSize: 13 }}>NEW RIDE REQUEST</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>KES {incomingRide.fare}</div>
            </div>
            
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', marginBottom: 8 }}>{incomingRide.riderName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888', fontSize: 14, marginBottom: 20 }}>
              <EnvironmentOutlined />
              <span>{Math.round(distKm(position ?? {lat:0,lng:0}, {lat: incomingRide.pickupLat, lng: incomingRide.pickupLng}))}km away</span>
            </div>

            <div style={{ background: '#F7F7F7', borderRadius: 16, padding: 16, marginBottom: 24, border: '1.5px solid #EBEBEB' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                  <div style={{ width: 1, height: 16, background: '#DDD' }} />
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: '#1A1A1A' }} />
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                  <p>///{incomingRide.pickupW3W}</p>
                  <div style={{ height: 1, background: '#DDD', margin: '8px 0' }} />
                  <p>///{incomingRide.destW3W}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setIncomingRide(null)} style={{ flex: 1, padding: '16px', borderRadius: 16, background: '#F7F7F7', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Decline</button>
              <button onClick={acceptRide} style={{ flex: 2, padding: '16px', borderRadius: 16, background: '#1A1A1A', color: '#FFFFFF', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: 16 }}>Accept Ride</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#FFFFFF', padding: '48px 20px 12px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.push('/home')} style={{ width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7', border: '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Driver Dashboard</h1>
              <p style={{ fontSize: 12, color: '#888' }}>{user.fullName ?? 'Driver'}</p>
            </div>
          </div>

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
          </button>
        </div>

        {!activeRide && (
          <div style={{ display: 'flex', gap: 6, background: '#F7F7F7', border: '1.5px solid #EBEBEB', borderRadius: 14, padding: 4 }}>
            {([
              { id: 'map',  Icon: GlobalOutlined,        label: 'Map' },
              { id: 'list', Icon: UnorderedListOutlined, label: `Jobs (${sorted.length})` },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: tab === t.id ? '#1A1A1A' : 'transparent',
                color: tab === t.id ? '#FFFFFF' : '#888',
                fontSize: 13, fontWeight: 700,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {tab === 'map' && <MapBase center={center} zoom={14} markers={markers} 
          routeTo={activeRide ? { lat: activeRide.pickupLat, lng: activeRide.pickupLng } : undefined}
          className="w-full h-full" />}
        
        {activeRide && (
          <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16, background: '#FFFFFF', borderRadius: 22, padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1.5px solid #EBEBEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F7F7F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{activeRide.riderName[0]}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Current Job</p>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A' }}>{activeRide.riderName}</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 18, fontWeight: 900 }}>KES {activeRide.fare}</p>
                <p style={{ fontSize: 11, color: '#22C55E', fontWeight: 800 }}>ACTIVE</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#F7F7F7', color: '#1A1A1A', border: '1.5px solid #EBEBEB', fontWeight: 700 }}>Contact</button>
              <button onClick={() => setActiveRide(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#1A1A1A', color: '#FFFFFF', border: 'none', fontWeight: 700 }}>Complete</button>
            </div>
          </div>
        )}

        {tab === 'list' && !activeRide && (
          <div style={{ position: 'absolute', inset: 0, background: '#F7F7F7', overflowY: 'auto', padding: 16 }}>
            {sorted.map(r => (
              <div key={r.code} style={{ background: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, border: '1.5px solid #EBEBEB' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F7F7F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EnvironmentOutlined style={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 800 }}>{r.userName || 'Anonymous'}</h4>
                    <p style={{ fontSize: 12, color: '#888' }}>{Math.round(distKm(position ?? {lat:0,lng:0}, r)*10)/10}km away</p>
                  </div>
                </div>
                <button onClick={() => router.push(`/track/${r.code}`)} style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#1A1A1A', color: '#FFFFFF', border: 'none', fontWeight: 700 }}>View Details</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes ride-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
