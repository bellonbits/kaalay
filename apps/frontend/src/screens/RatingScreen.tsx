import React, { useState } from 'react';
import { UserOutlined, StarFilled, StarOutlined } from '@ant-design/icons';

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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #8B7DC7 0%, #6A5EA8 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

      {/* Card */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: '28px 28px 0 0', padding: '28px 24px 48px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '6px' }}>You arrived!</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-gray)' }}>How was your trip? Rate your ride</p>
        </div>

        {/* Driver row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#3A3060', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserOutlined style={{ fontSize: '22px', color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>Brad Smith</div>
            <div style={{ fontSize: '13px', color: 'var(--purple)', fontWeight: '600' }}>Driver</div>
          </div>
          {/* Stars */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map(s => (
              s <= stars
                ? <StarFilled key={s} onClick={() => setStars(s)} style={{ fontSize: '22px', color: '#FFB800', cursor: 'pointer' }} />
                : <StarOutlined key={s} onClick={() => setStars(s)} style={{ fontSize: '22px', color: '#E0E0E6', cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        {/* Comment */}
        <textarea
          style={{ width: '100%', border: '1.5px solid #EFEFEF', borderRadius: '14px', padding: '14px', fontSize: '14px', color: 'var(--text-gray)', resize: 'none', height: '64px', fontFamily: 'inherit', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
          placeholder="Write your comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
        />

        {/* Tip */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-dark)' }}>Tip the driver</span>
            <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Trip cost £{tripCost.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TIPS.map(t => (
              <button
                key={t.value}
                onClick={() => setTip(t.value)}
                style={{
                  flex: 1,
                  padding: '12px 4px',
                  borderRadius: '12px',
                  border: 'none',
                  background: tip === t.value ? 'var(--green)' : '#F4F4F8',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: tip === t.value ? 'var(--text-dark)' : 'var(--text-gray)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-green" onClick={onDone}>
          Submit & Done
        </button>
      </div>
    </div>
  );
};

export default RatingScreen;
