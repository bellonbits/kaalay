import React, { useEffect } from 'react';
import { PhoneOutlined, StarFilled } from '@ant-design/icons';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onArrived: () => void;
  onCancel: () => void;
}

const DriverFoundScreen: React.FC<Props> = ({ pickup, destination, onArrived, onCancel }) => {
  useEffect(() => {
    const timer = setTimeout(onArrived, 8000);
    return () => clearTimeout(timer);
  }, [onArrived]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F5F8', display: 'flex', flexDirection: 'column' }}>
      {/* MAP — top 42% */}
      <div style={{ position: 'relative', flex: '0 0 42%' }}>
        <MapView
          center={{ lat: pickup.lat + 0.006, lng: pickup.lng - 0.002 }}
          zoom={13}
          pickup={pickup}
          destination={destination}
          driverLocation={{ lat: pickup.lat + 0.014, lng: pickup.lng + 0.008 }}
          showRoute
        />
        <button
          onClick={onCancel}
          style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 3L5 9L11 15" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* WHITE CARD — bottom 58% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* onboarding1.png — driver card image (Jane Cooper style) */}
        <div style={{ padding: '20px 20px 0' }}>
          <img
            src="/onboarding1.png"
            alt="Driver"
            style={{ width: '100%', borderRadius: '16px', objectFit: 'cover', maxHeight: '120px' }}
          />
        </div>

        {/* Arriving info */}
        <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#1A1A2E', lineHeight: 1.1 }}>Arriving</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#A8D83F', marginTop: '4px' }}>8 min</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>Audi A5 • Black</div>
            <div style={{ fontSize: '12px', color: '#8E8E9A', marginTop: '2px', fontWeight: '600', letterSpacing: '0.5px' }}>AV 6081 BD</div>
          </div>
        </div>

        <div style={{ height: '1px', background: '#F0F0F8', margin: '14px 22px' }} />

        {/* Driver row */}
        <div style={{ padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F0EEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              <img src="/icon.png" alt="driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E' }}>Brad Smith</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <StarFilled style={{ fontSize: '13px', color: '#FFB800' }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E' }}>5.0</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Message button — uses message.png as visual cue */}
            <button
              style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#F0F8E8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <img src="/message.png" alt="Chat" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            </button>
            <button
              style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#A8D83F', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <PhoneOutlined style={{ fontSize: '20px', color: '#1A1A2E' }} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }} />

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
