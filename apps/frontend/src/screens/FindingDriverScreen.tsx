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
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 3L5 9L11 15" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Address pill */}
        <div style={{ position: 'absolute', top: '16px', left: '64px', right: '16px', background: 'white', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', zIndex: 10 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F0F8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="6" r="2.5" stroke="#A8D83F" strokeWidth="1.8"/>
              <path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 13 7 13C7 13 12 9.5 12 6C12 3.24 9.76 1 7 1Z" stroke="#A8D83F" strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>{pickup.label}</div>
            <div style={{ fontSize: '12px', color: '#8E8E9A' }}>London City</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#C0C0CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* WHITE CARD — bottom 55% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {searching ? (
          /* Searching state — drivers network image */
          <>
            <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '16px' }}>
              <img src="/onboarding2.png" alt="Searching" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
              {/* Spinning ring overlay */}
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
          /* No driver / transition state */
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
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#7B61FF', flexShrink: 0, boxShadow: '0 0 0 3px rgba(123,97,255,0.15)' }} />
            <span style={{ fontSize: '14px', color: '#8E8E9A' }}>{destination.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '14px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#A8D83F', flexShrink: 0, boxShadow: '0 0 0 3px rgba(168,216,63,0.2)' }} />
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
