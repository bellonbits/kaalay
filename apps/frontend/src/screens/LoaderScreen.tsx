import React from 'react';

const LoaderScreen: React.FC = () => (
  <div style={{
    width: '100%', height: '100%',
    background: '#0F0F0F',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '28px',
  }}>
    {/* Logo wordmark */}
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>
        kaa<span style={{ color: '#A8D83F' }}>lay</span>
      </div>
      <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        ride with us
      </div>
    </div>

    {/* Spinner */}
    <div style={{ position: 'relative', width: '56px', height: '56px' }}>
      <svg
        style={{ animation: 'spin 1s linear infinite', position: 'absolute', inset: 0 }}
        width="56" height="56" viewBox="0 0 56 56"
      >
        <circle cx="28" cy="28" r="24" fill="none" stroke="#222" strokeWidth="3" />
        <circle cx="28" cy="28" r="24" fill="none" stroke="#A8D83F" strokeWidth="3"
          strokeLinecap="round" strokeDasharray="38 113" />
      </svg>
      <img
        src="/marker.png"
        alt=""
        style={{ position: 'absolute', inset: '14px', width: '28px', height: '28px', objectFit: 'contain', opacity: 0.8 }}
      />
    </div>

    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoaderScreen;
