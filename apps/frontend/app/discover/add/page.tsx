'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined, EnvironmentOutlined, CameraOutlined,
  TagOutlined, LoadingOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { convertTo3wa, createPlace } from '../../../lib/api';

export default function AddPlacePage() {
  const router = useRouter();
  const { position } = useGeolocation(true);
  
  const [name,   setName]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [w3w,    setW3w]    = useState('');
  const [tags,   setTags]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (position && !w3w) {
      convertTo3wa(position.lat, position.lng).then(res => setW3w(res.what3words)).catch(() => null);
    }
  }, [position, w3w]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !position || !w3w) return;
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
      await createPlace({
        name,
        description: desc || undefined,
        latitude: position.lat,
        longitude: position.lng,
        what3words: w3w,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        userId: user.id,
      });
      setSuccess(true);
      setTimeout(() => router.push('/discover'), 1500);
    } catch {
      alert('Failed to register place. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0FDF4', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <CheckOutlined style={{ fontSize: 40, color: '#FFFFFF' }} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A', marginBottom: 8 }}>Place Registered!</h2>
        <p style={{ color: '#15803D', fontWeight: 600 }}>Thank you for helping villages become searchable on Kaalay.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 16px', borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7',
            border: '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Register a Place</h1>
            <p style={{ fontSize: 12, color: '#888' }}>Help others find local businesses</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Place Name</p>
          <input 
            required
            style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: '1.5px solid #EBEBEB', fontSize: 14, fontWeight: 700, outline: 'none' }}
            placeholder="e.g. Mama Mboga's Fruit Stall"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* w3w status */}
        <div style={{ 
          background: '#1A1A1A', borderRadius: 16, padding: '16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EnvironmentOutlined style={{ fontSize: 20, color: '#FFD600' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Current w3w Address</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#FFFFFF' }}>{w3w ? `///${w3w}` : 'Detecting...'}</p>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Description (optional)</p>
          <textarea 
            style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: '1.5px solid #EBEBEB', fontSize: 14, fontWeight: 600, outline: 'none', resize: 'none' }}
            rows={3}
            placeholder="What makes this place special?"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Tags (comma separated)</p>
          <div style={{ position: 'relative' }}>
            <input 
              style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 16, border: '1.5px solid #EBEBEB', fontSize: 14, fontWeight: 600, outline: 'none' }}
              placeholder="food, market, hidden-gem"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
            <TagOutlined style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#BBBBBB' }} />
          </div>
        </div>

        {/* Photo Placeholder */}
        <div style={{ 
          width: '100%', height: 120, borderRadius: 20, border: '2px dashed #EBEBEB',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: '#888', cursor: 'pointer', background: '#FFFFFF'
        }}>
          <CameraOutlined style={{ fontSize: 24 }} />
          <p style={{ fontSize: 12, fontWeight: 700 }}>Add Photos</p>
        </div>
      </form>

      {/* Action bar */}
      <div style={{ background: '#FFFFFF', padding: '16px 20px 40px', borderTop: '1px solid #EBEBEB' }}>
        <button 
          onClick={handleSubmit}
          disabled={!name || !w3w || loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: (!name || !w3w) ? '#EBEBEB' : '#1A1A1A',
            color: (!name || !w3w) ? '#BBBBBB' : '#FFFFFF',
            fontSize: 16, fontWeight: 800, cursor: (!name || !w3w) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
          }}
        >
          {loading ? <LoadingOutlined /> : <CheckOutlined />}
          Confirm Registration
        </button>
      </div>
    </div>
  );
}
