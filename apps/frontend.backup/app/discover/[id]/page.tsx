'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined, EnvironmentOutlined, CompassOutlined,
  TagOutlined, ShareAltOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { getPlace } from '../../../lib/api';

export default function PlaceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [place, setPlace] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPlace(id as string)
        .then(setPlace)
        .catch(() => null)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #1A1A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!place) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7', padding: 32, textAlign: 'center' }}>
      <InfoCircleOutlined style={{ fontSize: 48, color: '#BBBBBB', marginBottom: 16 }} />
      <h2 style={{ fontSize: 20, fontWeight: 900 }}>Place not found</h2>
      <button onClick={() => router.back()} style={{ marginTop: 20, padding: '12px 24px', background: '#1A1A1A', color: '#FFFFFF', border: 'none', borderRadius: 12, fontWeight: 700 }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/* Visual Header */}
      <div style={{ height: '40%', position: 'relative', background: '#F3F4F6' }}>
        {place.photos?.[0] ? (
          <img src={place.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EnvironmentOutlined style={{ fontSize: 64, color: '#EBEBEB' }} />
          </div>
        )}
        
        {/* Navigation buttons */}
        <div style={{ position: 'absolute', top: 48, left: 20, right: 20, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
            <ArrowLeftOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
          </button>
          <button style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
            <ShareAltOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
          </button>
        </div>
      </div>

      {/* Details Container */}
      <div style={{ 
        flex: 1, background: '#FFFFFF', marginTop: -24, borderRadius: '24px 24px 0 0', 
        padding: '24px 20px', position: 'relative', boxShadow: '0 -8px 24px rgba(0,0,0,0.05)'
      }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', marginBottom: 8 }}>{place.name}</h1>
        
        <div style={{ background: '#F7F7F7', borderRadius: 16, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <EnvironmentOutlined style={{ fontSize: 20, color: '#1A1A1A' }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase' }}>Precision Address</p>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#1A1A1A' }}>///{place.what3words}</p>
          </div>
        </div>

        {place.description && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{place.description}</p>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Categories</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(place.tags ?? []).map((t: string) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#F3F4F6', borderRadius: 50 }}>
                <TagOutlined style={{ fontSize: 12, color: '#6B7280' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4B5563' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ padding: '16px 20px 40px', borderTop: '1px solid #EBEBEB', display: 'flex', gap: 12 }}>
        <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`)} style={{
          flex: 1, padding: '16px', borderRadius: 16, background: '#F7F7F7', color: '#1A1A1A',
          border: '1.5px solid #EBEBEB', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <CompassOutlined />
          Navigate
        </button>
        <button onClick={() => router.push(`/ride?dest=${place.what3words}`)} style={{
          flex: 1, padding: '16px', borderRadius: 16, background: '#1A1A1A', color: '#FFFFFF',
          border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer'
        }}>
          Request Ride
        </button>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
