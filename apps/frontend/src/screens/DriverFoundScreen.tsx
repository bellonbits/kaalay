import React, { useEffect } from 'react';
import { UserOutlined, MessageOutlined, PhoneOutlined, StarFilled } from '@ant-design/icons';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onArrived: () => void;
  onCancel: () => void;
}

/** Side-profile Audi A5 style SVG (dark/black) */
const AudiCar = () => (
  <svg width="72" height="40" viewBox="0 0 72 40" fill="none">
    {/* Body */}
    <rect x="3" y="18" width="66" height="16" rx="4" fill="#3A3A4E"/>
    {/* Cabin */}
    <rect x="14" y="8" width="40" height="14" rx="4" fill="#4A4A5E"/>
    {/* Windows */}
    <rect x="17" y="10" width="16" height="9" rx="2.5" fill="#7ECDE4" opacity="0.5"/>
    <rect x="36" y="10" width="14" height="9" rx="2.5" fill="#7ECDE4" opacity="0.5"/>
    {/* Wheels */}
    <circle cx="16" cy="34" r="6" fill="#1A1A2E"/>
    <circle cx="16" cy="34" r="3" fill="#555"/>
    <circle cx="56" cy="34" r="6" fill="#1A1A2E"/>
    <circle cx="56" cy="34" r="3" fill="#555"/>
    {/* Headlight */}
    <rect x="1" y="22" width="4" height="6" rx="1.5" fill="#FFF3A0"/>
    {/* Taillight */}
    <rect x="67" y="22" width="3" height="6" rx="1.5" fill="#FF4444" opacity="0.8"/>
    {/* Grill */}
    <rect x="1" y="18" width="4" height="10" rx="2" fill="#2A2A3A"/>
  </svg>
);


const DriverFoundScreen: React.FC<Props> = ({ pickup, destination, onArrived, onCancel }) => {
  useEffect(() => {
    const timer = setTimeout(onArrived, 8000);
    return () => clearTimeout(timer);
  }, [onArrived]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F5F8', display: 'flex', flexDirection: 'column' }}>
      {/* MAP — top 55% */}
      <div style={{ position: 'relative', flex: '0 0 55%' }}>
        <MapView
          center={{ lat: pickup.lat + 0.006, lng: pickup.lng - 0.002 }}
          zoom={13}
          pickup={pickup}
          destination={destination}
          driverLocation={{ lat: pickup.lat + 0.014, lng: pickup.lng + 0.008 }}
          showRoute
        />

        {/* Back button */}
        <button
          onClick={onCancel}
          style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 3L5 9L11 15" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* WHITE CARD — bottom 45% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', padding: '22px 22px 0', display: 'flex', flexDirection: 'column' }}>

        {/* Top row: Arriving info (left) + Car image (right) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1A1A2E', lineHeight: 1.1 }}>Arriving</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#A8D83F', marginTop: '4px' }}>8 min</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <AudiCar />
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E', marginTop: '6px' }}>Audi A5 • Black</div>
            <div style={{ fontSize: '12px', color: '#8E8E9A', marginTop: '2px', fontWeight: '600', letterSpacing: '0.5px' }}>AV 6081 BD</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: '#F0F0F8', marginBottom: '16px' }} />

        {/* Driver row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: avatar + name + rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#3A3060', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserOutlined style={{ fontSize: '22px', color: 'white' }} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E' }}>Brad Smith</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <StarFilled style={{ fontSize: '14px', color: '#FFB800' }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>5.0</span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#A8D83F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageOutlined style={{ fontSize: '20px', color: '#1A1A2E' }} />
            </button>
            <button style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#A8D83F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOutlined style={{ fontSize: '20px', color: '#1A1A2E' }} />
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Cancel — plain text */}
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', color: '#1A1A2E', cursor: 'pointer', padding: '16px 24px 32px', width: '100%', textAlign: 'center' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DriverFoundScreen;
