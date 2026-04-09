import React, { useEffect, useState } from 'react';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onDriverFound: () => void;
  onCancel: () => void;
}

const FindingDriverScreen: React.FC<Props> = ({ pickup, destination, onDriverFound, onCancel }) => {
  const [searching, setSearching] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearching(false);
      setTimeout(onDriverFound, 1200);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDriverFound]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F5F8', display: 'flex', flexDirection: 'column' }}>
      {/* MAP — top 45% */}
      <div style={{ position: 'relative', flex: '0 0 45%' }}>
        <MapView
          center={{ lat: (pickup.lat + destination.lat) / 2, lng: (pickup.lng + destination.lng) / 2 }}
          zoom={13}
          pickup={pickup}
          destination={destination}
          showRoute
        />

        {/* Back */}
        <button
          onClick={onCancel}
          style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <img src="/back-arrow.png" alt="back" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
        </button>

        {/* Address pill */}
        <div style={{ position: 'absolute', top: '16px', left: '64px', right: '16px', background: 'white', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', zIndex: 10 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F0F8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/pin.png" alt="pin" style={{ width: '16px', height: '16px', objectFit: 'contain', filter: 'invert(72%) sepia(60%) saturate(400%) hue-rotate(44deg) brightness(105%)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>{pickup.label}</div>
            <div style={{ fontSize: '12px', color: '#8E8E9A' }}>London City</div>
          </div>
          <img src="/arrow-down.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', opacity: 0.3, transform: 'rotate(-90deg)' }} />
        </div>
      </div>

      {/* WHITE CARD — bottom 55% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {searching ? (
          <>
            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '16px' }}>
              <img src="/onboarding2.png" alt="Searching" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
              <svg style={{ position: 'absolute', inset: '-8px', width: '136px', height: '136px', animation: 'spin 2s linear infinite' }} viewBox="0 0 136 136">
                <circle cx="68" cy="68" r="64" fill="none" stroke="#A8D83F" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 320"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1A1A2E', marginBottom: '6px', textAlign: 'center' }}>
              Looking for a driver...
            </h2>
            <p style={{ fontSize: '14px', color: '#8E8E9A', marginBottom: '28px', textAlign: 'center' }}>
              It may take some times
            </p>
          </>
        ) : (
          <>
            <img src="/no-result.png" alt="No driver" style={{ width: '110px', height: '110px', objectFit: 'contain', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1A1A2E', marginBottom: '6px', textAlign: 'center' }}>
              Driver found!
            </h2>
            <p style={{ fontSize: '14px', color: '#8E8E9A', marginBottom: '28px', textAlign: 'center' }}>
              Connecting you now...
            </p>
          </>
        )}

        {/* Route addresses */}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '14px', borderBottom: '1px solid #F4F4F8' }}>
            <img src="/to.png" alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0, filter: 'invert(44%) sepia(98%) saturate(2000%) hue-rotate(228deg) brightness(100%)' }} />
            <span style={{ fontSize: '14px', color: '#8E8E9A' }}>{destination.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '14px' }}>
            <img src="/point.png" alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0, filter: 'invert(72%) sepia(60%) saturate(400%) hue-rotate(44deg) brightness(105%)' }} />
            <span style={{ fontSize: '14px', color: '#8E8E9A' }}>{pickup.label}</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', color: '#1A1A2E', cursor: 'pointer', padding: '8px 24px' }}
        >
          Cancel
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FindingDriverScreen;
