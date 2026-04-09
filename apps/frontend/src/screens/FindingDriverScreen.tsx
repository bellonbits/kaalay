import React, { useEffect } from 'react';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onDriverFound: () => void;
  onCancel: () => void;
}

/** Animated search icon — grey circle, spinning green arc, magnifying glass */
const SearchingIcon: React.FC = () => (
  <div style={{ position: 'relative', width: '88px', height: '88px' }}>
    {/* Outer grey ring */}
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#F0F0F6' }} />
    {/* Spinning green arc */}
    <svg
      style={{ position: 'absolute', inset: 0, animation: 'spin 1.4s linear infinite' }}
      width="88" height="88" viewBox="0 0 88 88"
    >
      <circle
        cx="44" cy="44" r="40"
        fill="none"
        stroke="#A8D83F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="60 190"
      />
    </svg>
    {/* Magnifying glass */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="17" cy="17" r="10" stroke="#1A1A2E" strokeWidth="3"/>
        <path d="M25 25L34 34" stroke="#1A1A2E" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const FindingDriverScreen: React.FC<Props> = ({ pickup, destination, onDriverFound, onCancel }) => {
  useEffect(() => {
    const timer = setTimeout(onDriverFound, 5000);
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
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>{pickup.label || 'St Thomas, 19'}</div>
            <div style={{ fontSize: '12px', color: '#8E8E9A' }}>London City</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#C0C0CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* WHITE CARD — bottom 55% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', padding: '28px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Searching animation */}
        <SearchingIcon />

        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1A1A2E', marginTop: '20px', marginBottom: '6px', textAlign: 'center' }}>
          Looking for a driver...
        </h2>
        <p style={{ fontSize: '14px', color: '#8E8E9A', marginBottom: '28px', textAlign: 'center' }}>
          It may take some times
        </p>

        {/* Route addresses */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '14px', borderBottom: '1px solid #F4F4F8' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#7B61FF', border: '2px solid #7B61FF', flexShrink: 0, boxShadow: '0 0 0 3px rgba(123,97,255,0.15)' }} />
            <span style={{ fontSize: '14px', color: '#8E8E9A' }}>
              {destination.label || 'London Bridge Hospital (Entrance B)'}
            </span>
          </div>
          {/* Pickup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '14px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#A8D83F', border: '2px solid #A8D83F', flexShrink: 0, boxShadow: '0 0 0 3px rgba(168,216,63,0.2)' }} />
            <span style={{ fontSize: '14px', color: '#8E8E9A' }}>
              {pickup.label || 'St Thomas, 19'}
            </span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Cancel — plain text */}
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: '600', color: '#1A1A2E', cursor: 'pointer', padding: '8px 24px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default FindingDriverScreen;
