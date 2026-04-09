import React, { useState } from 'react';
import MapView from '../components/MapView';

interface Props {
  onSelectDestination: (pickup: Location, destination: Location) => void;
  onOpenPayment: () => void;
}

interface Location {
  lat: number;
  lng: number;
  label: string;
}

const QUICK_LOCATIONS = [
  { icon: '/home.png', label: 'Home', minutes: 45, lat: 51.515, lng: -0.09 },
  { icon: '/map.png', label: 'Office', minutes: 23, lat: 51.507, lng: -0.128 },
  { icon: '/list.png', label: 'School', minutes: 12, lat: 51.52, lng: -0.11 },
];

const HomeScreen: React.FC<Props> = ({ onSelectDestination }) => {
  const [search, setSearch] = useState('');
  const center = { lat: 51.5074, lng: -0.1278 };

  const handleQuick = (loc: typeof QUICK_LOCATIONS[number]) => {
    const pickup: Location = { lat: center.lat, lng: center.lng, label: 'Current Location' };
    const destination: Location = { lat: loc.lat, lng: loc.lng, label: loc.label };
    onSelectDestination(pickup, destination);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    const pickup: Location = { lat: center.lat, lng: center.lng, label: 'Current Location' };
    const destination: Location = { lat: 51.51, lng: -0.105, label: search };
    onSelectDestination(pickup, destination);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapView center={center} zoom={13} />

      {/* Top bar — car wheel hero image as background */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', overflow: 'hidden' }}>
        <img
          src="/signup-car.png"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.55 }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(26,26,46,0.7) 0%, rgba(26,26,46,0) 100%)' }} />
      </div>

      {/* Top bar content */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '52px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
        <button style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/list.png" alt="menu" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(10)' }} />
        </button>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/person.png" alt="profile" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(10)' }} />
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />

        {/* Search */}
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '24px' }}>
          <img src="/search.png" alt="" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', objectFit: 'contain', opacity: 0.5, zIndex: 1 }} />
          <input
            className="input-field"
            style={{ paddingLeft: '44px', background: '#F4F4F8', border: 'none', borderRadius: '50px', fontSize: '16px', fontWeight: '500' }}
            placeholder="Where we go?"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </form>

        {/* Quick locations */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-around' }}>
          {QUICK_LOCATIONS.map(loc => (
            <button
              key={loc.label}
              onClick={() => handleQuick(loc)}
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1C1C2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={loc.icon} alt={loc.label} style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'invert(72%) sepia(60%) saturate(400%) hue-rotate(44deg) brightness(105%)' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dark)' }}>{loc.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-gray)' }}>{loc.minutes} min</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
