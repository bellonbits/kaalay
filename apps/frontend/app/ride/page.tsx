'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, CarOutlined, SearchOutlined, EnvironmentOutlined,
  CheckOutlined, LoadingOutlined, DollarOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { convertTo3wa, convertToCoordinates, requestRide } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

export default function RidePage() {
  const router = useRouter();
  const { position } = useGeolocation(true);
  
  const [step,     setStep]     = useState<'select' | 'confirm' | 'waiting' | 'active'>('select');
  const [pickup,   setPickup]   = useState<{ w3w: string; lat: number; lng: number } | null>(null);
  const [dest,     setDest]     = useState<{ w3w: string; lat: number; lng: number } | null>(null);
  const [destIn,   setDestIn]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [price,    setPrice]    = useState<number | null>(null);
  const [rideId,   setRideId]   = useState<string | null>(null);
  const [driver,   setDriver]   = useState<any>(null);
  
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    setUser(JSON.parse(u));
  }, [router]);

  // Set default pickup to current location
  useEffect(() => {
    if (position && !pickup) {
      convertTo3wa(position.lat, position.lng).then(res => {
        setPickup({ w3w: res.what3words, lat: res.latitude, lng: res.longitude });
      }).catch(() => null);
    }
  }, [position, pickup]);

  const calculateFare = (pLat: number, pLng: number, dLat: number, dLng: number) => {
    const R = 6371;
    const dL = (dLat - pLat) * Math.PI / 180;
    const dG = (dLng - pLng) * Math.PI / 180;
    const a = Math.sin(dL / 2) ** 2 + Math.cos(pLat * Math.PI / 180) * Math.cos(dLat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((50 + distKm * 50) / 10) * 10;
  };

  const handleDestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const words = destIn.trim().replace(/^\/+/, '');
    if (!words) return;
    setLoading(true);
    try {
      const res = await convertToCoordinates(words);
      setDest({ w3w: res.what3words, lat: res.latitude, lng: res.longitude });
      if (pickup) {
        setPrice(calculateFare(pickup.lat, pickup.lng, res.latitude, res.longitude));
      }
      setStep('confirm');
    } catch (err) {
      alert('Address not found. Please use a what3words address (e.g. fill.count.soap)');
    } finally {
      setLoading(false);
    }
  };

  const confirmRide = async () => {
    if (!pickup || !dest || !user) return;
    setLoading(true);
    try {
      const r = await requestRide({
        riderId: user.id,
        pickupWhat3words: pickup.w3w,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationWhat3words: dest.w3w,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
      });
      setRideId(r.id);
      
      // Emit socket event to notify drivers
      getSocket().emit('ride:request', {
        rideId: r.id,
        pickupW3W: pickup.w3w,
        destW3W: dest.w3w,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destLat: dest.lat,
        destLng: dest.lng,
        riderName: user.fullName,
        fare: r.fare,
      });

      setStep('waiting');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Socket listener for ride acceptance and driver location
  useEffect(() => {
    if (step !== 'waiting' && step !== 'active') return;
    const s = getSocket();
    
    const onAccepted = (data: any) => {
      setDriver(data);
      setStep('active');
    };

    const onDriverLoc = (data: { rideId: string; lat: number; lng: number; heading?: number }) => {
      setDriver((prev: any) => ({ ...prev, ...data }));
    };

    s.on('ride:accepted', onAccepted);
    s.on('ride:driver_location', onDriverLoc);
    
    return () => { 
      s.off('ride:accepted', onAccepted); 
      s.off('ride:driver_location', onDriverLoc);
    };
  }, [step]);

  const markers: MarkerData[] = [
    ...(pickup ? [{ lat: pickup.lat, lng: pickup.lng, type: 'me' as const, label: 'Pickup' }] : []),
    ...(dest ? [{ lat: dest.lat, lng: dest.lng, type: 'request' as const, label: 'Destination' }] : []),
    ...(driver?.lat ? [{ lat: driver.lat, lng: driver.lng, type: 'car' as const, heading: driver.heading, label: driver.driverName }] : []),
  ];

  const center = pickup ?? position ?? { lat: -1.2921, lng: 36.8219 };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#F7F7F7' }}>
      {/* Map Background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapBase 
          center={center} 
          zoom={14} 
          markers={markers} 
          routeTo={dest ? { lat: dest.lat, lng: dest.lng } : undefined}
          className="w-full h-full" 
        />
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 48, left: 16, zIndex: 20 }}>
        <button onClick={() => router.back()} style={{
          width: 44, height: 44, borderRadius: '50%', background: '#FFFFFF',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>
          <ArrowLeftOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
        </button>
      </div>

      {/* Bottom Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: '#FFFFFF', borderRadius: '28px 28px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        padding: '24px 20px 48px',
        transition: 'transform 0.3s ease',
      }}>
        <div style={{ width: 40, height: 4, background: '#EBEBEB', borderRadius: 2, margin: '0 auto 20px' }} />

        {step === 'select' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A', marginBottom: 20 }}>Where to?</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 12, 
                padding: '14px 16px', background: '#F7F7F7', borderRadius: 16, border: '1.5px solid #EBEBEB'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Pickup</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    {pickup ? `///${pickup.w3w}` : 'Locating...'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleDestSearch} style={{ display: 'flex', gap: 8 }}>
                <div style={{ 
                  flex: 1, display: 'flex', alignItems: 'center', gap: 12, 
                  padding: '14px 16px', background: '#FFFFFF', borderRadius: 16, border: '2px solid #1A1A1A'
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
                  <input 
                    autoFocus
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: 'inherit' }}
                    placeholder="Enter what3words destination"
                    value={destIn}
                    onChange={e => setDestIn(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={loading || !destIn.trim()} style={{
                  width: 54, height: 54, borderRadius: 16, background: '#1A1A1A', color: '#FFFFFF',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {loading ? <LoadingOutlined /> : <SearchOutlined style={{ fontSize: 20 }} />}
                </button>
              </form>
            </div>
          </>
        )}

        {step === 'confirm' && dest && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Confirm Ride</h2>
              <div style={{ 
                background: '#FFD600', padding: '6px 14px', borderRadius: 50, 
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, fontSize: 16
              }}>
                <DollarOutlined />
                KES {price}
              </div>
            </div>

            <div style={{ background: '#F7F7F7', borderRadius: 20, padding: '16px', marginBottom: 24, border: '1.5px solid #EBEBEB' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                  <div style={{ width: 1, height: 24, background: '#EBEBEB' }} />
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1A1A1A' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>///{pickup?.w3w}</p>
                  <div style={{ height: 1, background: '#EBEBEB', margin: '12px 0' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>///{dest.w3w}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep('select')} style={{
                flex: 1, padding: '16px', borderRadius: 16, background: '#F7F7F7', color: '#1A1A1A',
                border: '1.5px solid #EBEBEB', fontWeight: 700, cursor: 'pointer'
              }}>
                Change
              </button>
              <button onClick={confirmRide} disabled={loading} style={{
                flex: 2, padding: '16px', borderRadius: 16, background: '#1A1A1A', color: '#FFFFFF',
                border: 'none', fontWeight: 800, fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }}>
                {loading ? <LoadingOutlined /> : <CarOutlined />}
                Request Kaalay
              </button>
            </div>
          </>
        )}

        {step === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: 80, height: 80, borderRadius: '50%', background: '#F7F7F7', 
              margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative'
            }}>
              <CarOutlined style={{ fontSize: 32, color: '#1A1A1A' }} />
              <div className="radar-ping" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', marginBottom: 8 }}>Finding your driver</h2>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>Connecting to nearby drivers using high-precision location</p>
            <button onClick={() => setStep('confirm')} style={{
              padding: '12px 24px', borderRadius: 50, background: '#FFF5F5', color: '#DC2626',
              border: '1.5px solid #FCA5A5', fontWeight: 700, cursor: 'pointer'
            }}>
              Cancel Request
            </button>
          </div>
        )}

        {step === 'active' && driver && (
          <div style={{ animation: 'slide-up 0.4s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: '50%', background: '#F7F7F7', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #EBEBEB'
              }}>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{driver.driverName[0]}</span>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A' }}>{driver.driverName} is coming</h2>
                <p style={{ fontSize: 13, color: '#888' }}>{driver.vehicleModel} · {driver.licensePlate}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  background: '#F0FDF4', color: '#16A34A', padding: '4px 10px', 
                  borderRadius: 50, fontSize: 11, fontWeight: 800, border: '1px solid #86EFAC'
                }}>
                  ARRIVING
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{
                flex: 1, padding: '14px', borderRadius: 16, background: '#F7F7F7', color: '#1A1A1A',
                border: '1.5px solid #EBEBEB', fontWeight: 700, cursor: 'pointer'
              }}>
                Message
              </button>
              <button style={{
                flex: 1, padding: '14px', borderRadius: 16, background: '#F7F7F7', color: '#1A1A1A',
                border: '1.5px solid #EBEBEB', fontWeight: 700, cursor: 'pointer'
              }}>
                Call
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .radar-ping {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          border: 2px solid #1A1A1A;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          opacity: 0;
        }
        @keyframes ping {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
