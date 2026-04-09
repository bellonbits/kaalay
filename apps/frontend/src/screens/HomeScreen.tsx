import React, { useState } from 'react';
import { HomeOutlined, BankOutlined, ReadOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
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
  { Icon: HomeOutlined, label: 'Home', minutes: 45, lat: 51.515, lng: -0.09 },
  { Icon: BankOutlined, label: 'Office', minutes: 23, lat: 51.507, lng: -0.128 },
  { Icon: ReadOutlined, label: 'School', minutes: 12, lat: 51.52, lng: -0.11 },
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
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(26,26,46,0.7) 0%, rgba(26,26,46,0) 100%)' }} />
      </div>

      {/* Top bar content */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '52px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
        <button style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect width="18" height="2" rx="1" fill="white"/>
            <rect y="6" width="12" height="2" rx="1" fill="white"/>
            <rect y="12" width="18" height="2" rx="1" fill="white"/>
          </svg>
        </button>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserOutlined style={{ fontSize: '20px', color: 'white' }} />
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />

        {/* Search */}
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '24px' }}>
          <SearchOutlined style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#8E8E9A', zIndex: 1 }} />
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
                <loc.Icon style={{ fontSize: '22px', color: '#A8D83F' }} />
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
