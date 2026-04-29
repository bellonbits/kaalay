'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, SearchOutlined, EnvironmentOutlined, PlusCircleOutlined,
  TagOutlined, CameraOutlined, CompassOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getNearbyPlaces, searchPlaces } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

export default function DiscoverPage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const [places,   setPlaces]   = useState<any[]>([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'map' | 'list'>('map');

  useEffect(() => {
    if (position && !search) {
      getNearbyPlaces(position.lat, position.lng, 5)
        .then(setPlaces)
        .catch(() => null);
    }
  }, [position, search]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await searchPlaces(search);
      setPlaces(res);
    } catch {
      // Silent error
    } finally {
      setLoading(false);
    }
  };

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const }] : []),
    ...places.map(p => ({ 
      lat: Number(p.latitude), 
      lng: Number(p.longitude), 
      type: 'request' as const, // Use yellow dots for places
      label: p.name 
    })),
  ];

  const center = position ?? { lat: -1.2921, lng: 36.8219 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 16px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7',
            border: '1.5px solid #EBEBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A' }}>Local Discovery</h1>
            <p style={{ fontSize: 12, color: '#888' }}>Find villages, stalls & hidden gems</p>
          </div>
          <button onClick={() => router.push('/discover/add')} style={{
            background: '#1A1A1A', color: '#FFFFFF', padding: '10px 16px', borderRadius: 12,
            border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <PlusCircleOutlined />
            Register Place
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ position: 'relative' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 12, 
            padding: '12px 16px', background: '#F7F7F7', borderRadius: 16, border: '1.5px solid #EBEBEB'
          }}>
            <SearchOutlined style={{ color: '#BBBBBB' }} />
            <input 
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}
              placeholder="Search for 'Smokie' or 'Village name'..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#FFFFFF', padding: '0 20px 12px', borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', gap: 4, background: '#F7F7F7', borderRadius: 12, padding: 4, width: '100%' }}>
          <button onClick={() => setTab('map')} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === 'map' ? '#FFFFFF' : 'transparent',
            boxShadow: tab === 'map' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            fontSize: 12, fontWeight: 800, color: tab === 'map' ? '#1A1A1A' : '#888',
          }}>Map</button>
          <button onClick={() => setTab('list')} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === 'list' ? '#FFFFFF' : 'transparent',
            boxShadow: tab === 'list' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            fontSize: 12, fontWeight: 800, color: tab === 'list' ? '#1A1A1A' : '#888',
          }}>List View ({places.length})</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative' }}>
        {tab === 'map' ? (
          <MapBase center={center} zoom={14} markers={markers} className="w-full h-full" />
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {places.map(p => (
              <div key={p.id} onClick={() => router.push(`/discover/${p.id}`)} style={{
                background: '#FFFFFF', borderRadius: 20, padding: 16, border: '1.5px solid #EBEBEB',
                display: 'flex', gap: 14, cursor: 'pointer'
              }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: 16, background: '#F7F7F7', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                }}>
                  {p.photos?.[0] ? (
                    <img src={p.photos[0]} alt="" style={{ width: '100%', height: '100%', borderRadius: 16, objectFit: 'cover' }} />
                  ) : (
                    <EnvironmentOutlined style={{ fontSize: 24, color: '#BBBBBB' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', marginBottom: 4 }}>{p.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888', fontSize: 12, marginBottom: 8 }}>
                    <CompassOutlined />
                    <span>///{p.what3words}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(p.tags ?? []).slice(0, 3).map((t: string) => (
                      <span key={t} style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', background: '#F3F4F6', color: '#6B7280', borderRadius: 20 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {places.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                <EnvironmentOutlined style={{ fontSize: 48, color: '#EBEBEB', marginBottom: 16 }} />
                <p style={{ fontWeight: 700 }}>No places found here yet</p>
                <p style={{ fontSize: 13 }}>Be the first to register a local landmark!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
