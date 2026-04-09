import React, { useState } from 'react';
import MapView from '../components/MapView';

interface Location { lat: number; lng: number; label: string }

interface Props {
  pickup: Location;
  destination: Location;
  onBook: (rideType: string) => void;
  onBack: () => void;
}

const RIDE_TYPES = [
  {
    id: 'standard',
    label: 'Standard',
    seats: 4,
    minutes: 7,
    price: '£5.50',
    originalPrice: null as string | null,
    tag: null as string | null,
    image: '/onboarding3.png',
  },
  {
    id: 'eco',
    label: 'Eco',
    seats: 4,
    minutes: 8,
    price: '£6.50',
    originalPrice: '£7.65',
    tag: 'Eco',
    image: '/signup-car.png',
  },
  {
    id: 'business',
    label: 'Business',
    seats: 4,
    minutes: 10,
    price: '£9.00',
    originalPrice: null,
    tag: 'Faster',
    image: '/onboarding1.png',
  },
];

const RideSelectScreen: React.FC<Props> = ({ pickup, destination, onBook, onBack }) => {
  const [selected, setSelected] = useState('standard');
  const selectedRide = RIDE_TYPES.find(r => r.id === selected)!;

  return (
    <div style={{ width: '100%', height: '100%', background: '#0F0F0F', display: 'flex', flexDirection: 'column' }}>

      {/* MAP — top 48% */}
      <div style={{ position: 'relative', flex: '0 0 48%' }}>
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
          style={{ position: 'absolute', top: '16px', left: '16px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <img src="/back-arrow.png" alt="back" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
        </button>

        {/* Destination pill */}
        <div style={{ position: 'absolute', top: '16px', left: '64px', right: '16px', background: 'white', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)', zIndex: 10 }}>
          <img src="/pin.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', filter: 'invert(72%) sepia(60%) saturate(400%) hue-rotate(44deg) brightness(105%)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {destination.label}
            </div>
          </div>
          <img src="/arrow-down.png" alt="" style={{ width: '14px', height: '14px', objectFit: 'contain', opacity: 0.35, transform: 'rotate(-90deg)', flexShrink: 0 }} />
        </div>
      </div>

      {/* DARK BOTTOM SHEET */}
      <div style={{
        flex: 1,
        background: '#141414',
        borderRadius: '20px 20px 0 0',
        marginTop: '-16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#333' }} />
        </div>

        {/* Promo banner */}
        <div style={{ margin: '12px 16px 4px', background: 'rgba(168,216,63,0.1)', borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#A8D83F', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#A8D83F' }}>15% promotion applied</span>
          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#A8D83F" strokeWidth="1.2"/>
            <path d="M8 5V8.5M8 10.5V11" stroke="#A8D83F" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Ride list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px', scrollbarWidth: 'none' }}>
          {RIDE_TYPES.map(rt => {
            const isSelected = selected === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => setSelected(rt.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px',
                  borderRadius: '14px',
                  border: isSelected ? '1.5px solid rgba(255,255,255,0.8)' : '1.5px solid transparent',
                  background: isSelected ? '#222' : '#1A1A1A',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s',
                }}
              >
                {/* Car image on dark platform */}
                <div style={{ width: '72px', height: '48px', borderRadius: '10px', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  <img src={rt.image} alt={rt.label} style={{ width: '68px', height: '44px', objectFit: 'contain' }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{rt.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <img src="/person.png" alt="" style={{ width: '12px', height: '12px', objectFit: 'contain', filter: 'brightness(3) opacity(0.5)' }} />
                      <span style={{ fontSize: '12px', color: '#666' }}>{rt.seats}</span>
                    </div>
                    {rt.tag && (
                      <div style={{
                        background: rt.tag === 'Eco' ? 'rgba(168,216,63,0.15)' : 'rgba(100,160,255,0.15)',
                        borderRadius: '6px',
                        padding: '2px 7px',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {rt.tag === 'Faster' && (
                          <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
                            <path d="M5 1L1 7H4.5L4 11L8 5H4.5L5 1Z" fill="#6AA0FF" strokeLinejoin="round"/>
                          </svg>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: '700', color: rt.tag === 'Eco' ? '#A8D83F' : '#6AA0FF' }}>{rt.tag}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: '#555' }}>{rt.minutes} min away</span>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    {rt.originalPrice && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#A8D83F', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{rt.price}</span>
                  </div>
                  {rt.originalPrice && (
                    <span style={{ fontSize: '12px', color: '#444', textDecoration: 'line-through' }}>{rt.originalPrice}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '12px 16px 36px', display: 'flex', gap: '10px', borderTop: '1px solid #1E1E1E' }}>
          <button
            onClick={() => onBook(selected)}
            style={{
              flex: 1,
              height: '54px',
              borderRadius: '14px',
              background: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: '700',
              color: '#0F0F0F',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            Choose {selectedRide.label}
          </button>
          <button style={{
            width: '54px', height: '54px', borderRadius: '14px', background: '#1E1E1E',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#555" strokeWidth="1.8"/>
              <path d="M12 7.5V12L15 15" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideSelectScreen;
