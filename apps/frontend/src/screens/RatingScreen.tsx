import React, { useState } from 'react';

interface Props {
  onDone: () => void;
}

const TIPS = [
  { label: 'No tip', value: 0 },
  { label: '£1.00', value: 1 },
  { label: '£2.00', value: 2 },
  { label: '£5.00', value: 5 },
];

const RatingScreen: React.FC<Props> = ({ onDone }) => {
  const [stars, setStars] = useState(4);
  const [tip, setTip] = useState(1);
  const [comment, setComment] = useState('');

  const tripCost = 5.50;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#F5F5F8' }}>
      {/* get-started.png as blurred background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src="/get-started.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(2px) brightness(0.5)', transform: 'scale(1.05)' }} />
      </div>

      {/* check.png — arrived badge */}
      <div style={{ position: 'absolute', top: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 2 }}>
        <img src="/check.png" alt="Arrived" style={{ width: '64px', height: '64px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
        <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', opacity: 0.9 }}>TRIP COMPLETED</span>
      </div>

      {/* White card */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '28px 28px 0 0', padding: '28px 24px 48px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', marginBottom: '6px' }}>You arrived!</h2>
          <p style={{ fontSize: '14px', color: '#8E8E9A' }}>How was your trip? Rate your ride</p>
        </div>

        {/* Driver row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F0EEFF', flexShrink: 0, overflow: 'hidden' }}>
            <img src="/icon.png" alt="driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E' }}>Brad Smith</div>
            <div style={{ fontSize: '13px', color: '#7B61FF', fontWeight: '600' }}>Driver</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <img
                key={s}
                src="/star.png"
                alt="star"
                onClick={() => setStars(s)}
                style={{
                  width: '26px',
                  height: '26px',
                  objectFit: 'contain',
                  cursor: 'pointer',
                  filter: s <= stars
                    ? 'invert(76%) sepia(80%) saturate(600%) hue-rotate(2deg) brightness(105%)'
                    : 'grayscale(100%) brightness(1.6)',
                  transition: 'filter 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Comment */}
        <textarea
          style={{ width: '100%', border: '1.5px solid #EFEFEF', borderRadius: '14px', padding: '14px', fontSize: '14px', color: '#8E8E9A', resize: 'none', height: '64px', fontFamily: 'inherit', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
          placeholder="Write your comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />

        {/* Tip */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/dollar.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', opacity: 0.6 }} />
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#1A1A2E' }}>Tip the driver</span>
            </div>
            <span style={{ fontSize: '13px', color: '#8E8E9A' }}>Trip cost £{tripCost.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TIPS.map(t => (
              <button
                key={t.value}
                onClick={() => setTip(t.value)}
                style={{ flex: 1, padding: '12px 4px', borderRadius: '12px', border: 'none', background: tip === t.value ? '#A8D83F' : '#F4F4F8', fontSize: '13px', fontWeight: '700', color: tip === t.value ? '#1A1A2E' : '#8E8E9A', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-green" onClick={onDone}>
          Submit &amp; Done
        </button>
      </div>
    </div>
  );
};

export default RatingScreen;
