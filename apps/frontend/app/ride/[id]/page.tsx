'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, CarOutlined, CheckCircleFilled,
  EnvironmentOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { useSocket } from '../../../hooks/useSocket';
import { getRide, updateRideStatus } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type { MarkerData } from '../../../components/MapBase';

const MapBase = dynamic(() => import('../../../components/MapBase'), { ssr: false });

type RideStatus = 'requested' | 'driver_assigned' | 'driver_arriving' | 'in_progress' | 'completed' | 'cancelled';

interface RideData {
  id: string;
  status: RideStatus;
  pickupWhat3words: string;
  pickupLat: number; pickupLng: number;
  destinationWhat3words: string;
  destinationLat: number; destinationLng: number;
  fare: number;
  driver?: { id: string; vehicleModel: string; vehicleColor: string; licensePlate: string; user?: { fullName: string } };
}

interface DriverInfo {
  driverName: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
}

const STATUS_LABEL: Record<RideStatus, string> = {
  requested:       'Waiting for a driver…',
  driver_assigned: 'Driver is on the way',
  driver_arriving: 'Driver is arriving!',
  in_progress:     'Ride in progress',
  completed:       'Ride complete',
  cancelled:       'Ride cancelled',
};

const STATUS_COLOR: Record<RideStatus, string> = {
  requested:       '#888',
  driver_assigned: '#7C3AED',
  driver_arriving: '#FFD600',
  in_progress:     '#22C55E',
  completed:       '#1A1A1A',
  cancelled:       '#DC2626',
};

export default function RideTrackingPage() {
  const params    = useParams();
  const rideId    = params?.id as string;
  const router    = useRouter();
  const { position: me } = useGeolocation(false);
  const socketRef = useSocket();

  const [ride,       setRide]       = useState<RideData | null>(null);
  const [status,     setStatus]     = useState<RideStatus>('requested');
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [driverPos,  setDriverPos]  = useState<{ lat: number; lng: number } | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Load ride data
  useEffect(() => {
    if (!rideId) return;
    getRide(rideId)
      .then((r: RideData) => { setRide(r); setStatus(r.status); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rideId]);

  // Join ride room + listen for socket events
  useEffect(() => {
    if (!rideId) return;
    const s = socketRef.current;
    if (!s) return;

    s.emit('ride:join', { rideId });

    const onAccepted = (info: DriverInfo) => {
      setDriverInfo(info);
      setStatus('driver_assigned');
    };
    const onStatus = ({ status: st }: { status: RideStatus }) => setStatus(st);
    const onDriverLocation = ({ lat, lng }: { lat: number; lng: number }) => setDriverPos({ lat, lng });

    s.on('ride:accepted', onAccepted);
    s.on('ride:status', onStatus);
    s.on('ride:driver_location', onDriverLocation);

    return () => {
      s.off('ride:accepted', onAccepted);
      s.off('ride:status', onStatus);
      s.off('ride:driver_location', onDriverLocation);
    };
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelRide = async () => {
    if (!rideId) return;
    await updateRideStatus(rideId, 'cancelled').catch(() => null);
    router.push('/home');
  };

  const markers: MarkerData[] = [
    ...(me ? [{ lat: me.lat, lng: me.lng, type: 'me' as const, accuracy: me.accuracy }] : []),
    ...(driverPos ? [{ lat: driverPos.lat, lng: driverPos.lng, type: 'car' as const, label: driverInfo?.driverName }] : []),
    ...(ride ? [{ lat: Number(ride.destinationLat), lng: Number(ride.destinationLng), type: 'request' as const, label: `///${ride.destinationWhat3words}` }] : []),
  ];

  const center = driverPos ?? me ?? (ride ? { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) } : { lat: -1.29, lng: 36.82 });
  const effectiveDriver = driverInfo ?? (ride?.driver ? {
    driverName: ride.driver.user?.fullName ?? 'Driver',
    vehicleModel: ride.driver.vehicleModel,
    vehicleColor: ride.driver.vehicleColor,
    licensePlate: ride.driver.licensePlate,
  } : null);

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <LoadingOutlined style={{ fontSize: 32, color: '#1A1A1A' }} />
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Map */}
      <div style={{ position: 'relative', flex: 1 }}>
        <MapBase center={center} zoom={14} markers={markers}
          routeTo={status === 'driver_assigned' || status === 'driver_arriving'
            ? { lat: Number(ride?.pickupLat), lng: Number(ride?.pickupLng) }
            : undefined}
          className="w-full h-full" />

        <button onClick={() => router.push('/home')} style={{
          position: 'absolute', top: 48, left: 16, zIndex: 10,
          width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}>
          <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
        </button>

        {/* Status pill */}
        <div style={{
          position: 'absolute', top: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            background: status === 'driver_arriving' ? '#FFD600' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)', borderRadius: 50,
            padding: '8px 18px', border: '1px solid #EBEBEB',
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {status === 'requested' && <LoadingOutlined style={{ fontSize: 12, color: '#888' }} />}
            {(status === 'driver_assigned' || status === 'driver_arriving') && (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[status], animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
            )}
            {status === 'in_progress' && <CarOutlined style={{ fontSize: 12, color: '#22C55E' }} />}
            {status === 'completed' && <CheckCircleFilled style={{ fontSize: 12, color: '#1A1A1A' }} />}
            <span style={{ fontSize: 12, fontWeight: 800, color: status === 'driver_arriving' ? '#1A1A1A' : STATUS_COLOR[status] }}>
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom card */}
      <div style={{ background: '#FFFFFF', padding: '20px 20px 40px', boxShadow: '0 -4px 32px rgba(0,0,0,0.10)' }}>

        {/* Driver card — shown once assigned */}
        {effectiveDriver && status !== 'requested' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#F7F7F7', border: '1.5px solid #EBEBEB',
            borderRadius: 18, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: '#1A1A1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CarOutlined style={{ fontSize: 22, color: '#FFD600' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>{effectiveDriver.driverName}</p>
              <p style={{ fontSize: 12, color: '#888' }}>
                {effectiveDriver.vehicleColor} {effectiveDriver.vehicleModel}
              </p>
            </div>
            <div style={{
              padding: '6px 12px', background: '#1A1A1A', borderRadius: 10,
              fontSize: 13, fontWeight: 900, color: '#FFD600', letterSpacing: '1px',
            }}>
              {effectiveDriver.licensePlate}
            </div>
          </div>
        )}

        {/* Route row */}
        {ride && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F7F7F7', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #EBEBEB', marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
              <div style={{ width: 1, height: 20, background: '#EBEBEB' }} />
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#FFD600' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, color: '#888' }}>Pickup</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ///{ride.pickupWhat3words}
              </p>
              <div style={{ height: 1, background: '#EBEBEB', margin: '6px 0' }} />
              <p style={{ fontSize: 11, color: '#888' }}>Drop-off</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ///{ride.destinationWhat3words}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A' }}>KES {ride.fare}</p>
              <p style={{ fontSize: 10, color: '#888' }}>est. fare</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {status === 'completed' ? (
          <button onClick={() => router.push('/home')} style={{
            width: '100%', padding: '16px', background: '#1A1A1A', color: '#FFFFFF',
            border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            Done
          </button>
        ) : status === 'cancelled' ? (
          <button onClick={() => router.push('/ride')} style={{
            width: '100%', padding: '16px', background: '#FFD600', color: '#1A1A1A',
            border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            Book another ride
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${ride?.destinationLat},${ride?.destinationLng}`, '_blank')} style={{
              flex: 1, padding: '14px', background: '#F7F7F7', color: '#1A1A1A',
              border: '1.5px solid #EBEBEB', borderRadius: 16, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              <EnvironmentOutlined style={{ fontSize: 14 }} />
              Open Maps
            </button>
            {(status === 'requested' || status === 'driver_assigned') && (
              <button onClick={cancelRide} style={{
                flex: 1, padding: '14px', background: '#FFF5F5', color: '#DC2626',
                border: '1.5px solid #FCA5A5', borderRadius: 16, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                Cancel ride
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
