import React, { useState } from 'react';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onBook: (rideType: string) => void;
  onBack: () => void;
  onOpenPayment: () => void;
}

/* ─── Car SVGs (side-profile) ─── */
const GreenCar = () => (
  <svg width="96" height="52" viewBox="0 0 96 52" fill="none">
    {/* Body */}
    <rect x="6" y="26" width="84" height="20" rx="6" fill="#A8D83F"/>
    {/* Cabin */}
    <rect x="20" y="12" width="52" height="18" rx="6" fill="#C4EE60"/>
    {/* Windows */}
    <rect x="24" y="15" width="20" height="12" rx="3" fill="#7ECDE4" opacity="0.85"/>
    <rect x="47" y="15" width="20" height="12" rx="3" fill="#7ECDE4" opacity="0.85"/>
    {/* Checkerboard stripe */}
    {[0,1,2,3,4,5,6,7,8,9].map(i => (
      <rect key={i} x={6 + i * 8} y={33} width={8} height={7} fill={i % 2 === 0 ? '#1A1A2E' : '#A8D83F'}/>
    ))}
    {/* Wheels */}
    <circle cx="22" cy="46" r="8" fill="#1A1A2E"/>
    <circle cx="22" cy="46" r="4" fill="#555"/>
    <circle cx="74" cy="46" r="8" fill="#1A1A2E"/>
    <circle cx="74" cy="46" r="4" fill="#555"/>
    {/* Headlight */}
    <rect x="3" y="30" width="5" height="8" rx="2" fill="#FFF3A0"/>
    {/* Taillight */}
    <rect x="88" y="30" width="4" height="8" rx="2" fill="#FF4444" opacity="0.8"/>
  </svg>
);

const GreyCar = () => (
  <svg width="88" height="46" viewBox="0 0 88 46" fill="none">
    <rect x="4" y="22" width="80" height="18" rx="5" fill="#C8C8D8"/>
    <rect x="16" y="10" width="50" height="16" rx="5" fill="#E0E0EC"/>
    <rect x="20" y="13" width="18" height="10" rx="3" fill="#7ECDE4" opacity="0.7"/>
    <rect x="42" y="13" width="18" height="10" rx="3" fill="#7ECDE4" opacity="0.7"/>
    <circle cx="20" cy="40" r="7" fill="#555"/>
    <circle cx="20" cy="40" r="3.5" fill="#888"/>
    <circle cx="68" cy="40" r="7" fill="#555"/>
    <circle cx="68" cy="40" r="3.5" fill="#888"/>
    <rect x="2" y="26" width="4" height="7" rx="2" fill="#FFF3A0"/>
    <rect x="82" y="26" width="4" height="7" rx="2" fill="#FF4444" opacity="0.7"/>
  </svg>
);

const DarkCar = () => (
  <svg width="92" height="48" viewBox="0 0 92 48" fill="none">
    <rect x="4" y="24" width="84" height="18" rx="6" fill="#5A5A6E"/>
    <rect x="18" y="12" width="52" height="16" rx="5" fill="#7070888"/>
    <rect x="18" y="12" width="52" height="16" rx="5" fill="#6E6E80"/>
    <rect x="22" y="15" width="20" height="10" rx="3" fill="#7ECDE4" opacity="0.6"/>
    <rect x="46" y="15" width="20" height="10" rx="3" fill="#7ECDE4" opacity="0.6"/>
    <circle cx="22" cy="42" r="7" fill="#2A2A3E"/>
    <circle cx="22" cy="42" r="3.5" fill="#555"/>
    <circle cx="70" cy="42" r="7" fill="#2A2A3E"/>
    <circle cx="70" cy="42" r="3.5" fill="#555"/>
    <rect x="2" y="28" width="4" height="7" rx="2" fill="#FFF3A0"/>
    <rect x="86" y="28" width="4" height="7" rx="2" fill="#FF4444" opacity="0.7"/>
  </svg>
);

const EcoBadge = () => (
  <div style={{
    position: 'absolute', top: '10px', right: '10px',
    width: '22px', height: '22px', borderRadius: '50%',
    background: '#A8D83F', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 10C2 10 3 6 6 5C9 4 10 2 10 2C10 2 9 7 6 8C3 9 2 10 2 10Z" fill="white" stroke="white" strokeWidth="0.5"/>
    </svg>
  </div>
);

const RIDE_TYPES = [
  { id: 'standard', label: 'Standard', minutes: 7, price: '£5.50', Car: GreenCar, eco: false },
  { id: 'eco', label: 'Eco', minutes: 8, price: '£6.50', Car: GreyCar, eco: true },
  { id: 'business', label: 'Business', minutes: 10, price: '£9.00', Car: DarkCar, eco: false },
];

const RideSelectScreen: React.FC<Props> = ({ pickup, destination, onBook, onBack, onOpenPayment }) => {
  const [selected, setSelected] = useState('standard');

  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F5F8', display: 'flex', flexDirection: 'column' }}>
      {/* MAP AREA — top 52% */}
      <div style={{ position: 'relative', flex: '0 0 52%' }}>
        <MapView
          center={{ lat: (pickup.lat + destination.lat) / 2, lng: (pickup.lng + destination.lng) / 2 }}
          zoom={13}
          pickup={pickup}
          destination={destination}
          showRoute
        />

        {/* Back button */}
        <button
          onClick={onBack}
          style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 3L5 9L11 15" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Address pill on map */}
        <div style={{ position: 'absolute', top: '16px', left: '64px', right: '16px', background: 'white', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', zIndex: 10 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F0F8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="6" r="2.5" stroke="#A8D83F" strokeWidth="1.8"/>
              <path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 13 7 13C7 13 12 9.5 12 6C12 3.24 9.76 1 7 1Z" stroke="#A8D83F" strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {destination.label || 'St Thomas, 19'}
            </div>
            <div style={{ fontSize: '12px', color: '#8E8E9A' }}>London City</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#8E8E9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* WHITE CARD — bottom 48% */}
      <div style={{ flex: 1, background: 'white', borderRadius: '24px 24px 0 0', marginTop: '-20px', padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>

        {/* Ride type cards — horizontal scroll */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {RIDE_TYPES.map(rt => {
            const isSelected = selected === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => setSelected(rt.id)}
                style={{
                  flex: '0 0 120px',
                  padding: '14px 12px 12px',
                  borderRadius: '18px',
                  border: 'none',
                  background: isSelected ? '#7B61FF' : '#F4F4F8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'all 0.2s',
                  overflow: 'hidden',
                }}
              >
                {rt.eco && <EcoBadge />}
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-start' }}>
                  <rt.Car />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: isSelected ? 'white' : '#1A1A2E', marginBottom: '2px' }}>
                  {rt.label}
                </div>
                <div style={{ fontSize: '12px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#8E8E9A', marginBottom: '4px' }}>
                  {rt.minutes} min
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: isSelected ? '#FFD93D' : '#7B61FF' }}>
                  {rt.price}
                </div>
              </button>
            );
          })}
        </div>

        {/* Payment method */}
        <button
          onClick={onOpenPayment}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: '1.5px solid #F0F0F6', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Apple Pay pill */}
            <div style={{ background: '#1A1A2E', borderRadius: '6px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                <path d="M7 1C3.69 1 1 3.69 1 7C1 10.31 3.69 13 7 13C10.31 13 13 10.31 13 7C13 3.69 10.31 1 7 1ZM6 9.5L3.5 7L4.21 6.29L6 8.08L9.79 4.29L10.5 5L6 9.5Z"/>
              </svg>
              <span style={{ color: 'white', fontSize: '10px', fontWeight: '700' }}>Pay</span>
            </div>
            <span style={{ fontSize: '14px', color: '#1A1A2E', fontWeight: '500', letterSpacing: '1px' }}>•••• 4383</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#C0C0CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Book + Schedule */}
        <div style={{ display: 'flex', gap: '10px', paddingBottom: '32px' }}>
          <button
            className="btn-green"
            style={{ flex: 1, fontSize: '17px', fontWeight: '700' }}
            onClick={() => onBook(selected)}
          >
            Book Taxi
          </button>
          <button style={{
            width: '54px', height: '54px', borderRadius: '16px', background: '#F4F4F8',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#8E8E9A" strokeWidth="1.8"/>
              <path d="M12 7.5V12L15 15" stroke="#8E8E9A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideSelectScreen;
