'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  SearchOutlined, EnvironmentOutlined, PlusCircleOutlined,
  CompassOutlined, LoadingOutlined, RadarChartOutlined,
  ArrowLeftOutlined, FireOutlined, GlobalOutlined,
  AppstoreOutlined, CompassFilled
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
  const [tab,      setTab]      = useState<'map' | 'list'>('list');

  useEffect(() => {
    if (position && !search) {
      getNearbyPlaces(position.lat, position.lng, 10)
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
    } finally {
      setLoading(false);
    }
  };

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const }] : []),
    ...places.map(p => ({ 
      lat: Number(p.latitude), 
      lng: Number(p.longitude), 
      type: 'request' as const, 
      label: p.name 
    })),
  ];

  const center = position ?? { lat: -1.2921, lng: 36.8219 };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden font-outfit relative">
      {/* Background Decor */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-yellow-400/5 rounded-full blur-[100px]" />

      {/* Premium Header */}
      <div className="pt-12 px-6 pb-5 bg-white/90 backdrop-blur-xl z-30 sticky top-0 border-b border-gray-50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="w-10 h-10 bg-black rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-premium"
            >
              <ArrowLeftOutlined className="text-lg text-white" />
            </button>
            <h1 className="text-2xl font-black text-black tracking-tight">Discovery</h1>
          </div>
          <button 
            onClick={() => router.push('/discover/add')}
            className="w-12 h-12 bg-black text-yellow-400 rounded-2xl flex items-center justify-center shadow-premium active:scale-95 transition-transform"
          >
            <PlusCircleOutlined className="text-xl" />
          </button>
        </div>

        {/* Search & Toggle Bar */}
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="input-container !bg-gray-50 !h-14">
            <SearchOutlined className="text-lg text-gray-300" />
            <input 
              placeholder="Search shops, stalls, or squares..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black placeholder:text-gray-300"
            />
            {loading && <LoadingOutlined className="text-gray-300" />}
          </form>

          <div className="flex p-1.5 bg-gray-100 rounded-2xl">
            <button 
              onClick={() => setTab('list')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${tab === 'list' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
            >
              <AppstoreOutlined />
              <span>LIST VIEW</span>
            </button>
            <button 
              onClick={() => setTab('map')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${tab === 'map' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
            >
              <CompassFilled />
              <span>INTERACTIVE MAP</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Always Mounted for Stability */}
      <div className="flex-1 relative pb-40">
        {/* Map View */}
        <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${tab === 'map' ? 'opacity-100 z-10' : 'opacity-0 -z-10 pointer-events-none'}`}>
          <MapBase key="discover-map-instance" center={center} zoom={14} markers={markers} className="w-full h-full" />
        </div>

        {/* List View */}
        <div className={`absolute inset-0 overflow-y-auto no-scroll transition-opacity duration-500 ${tab === 'list' ? 'opacity-100 z-10' : 'opacity-0 -z-10 pointer-events-none'}`}>
          <div className="px-6 py-8 space-y-8 animate-slide-up-spring">
            {/* Featured Square */}
            {places.length > 0 && !search && (
              <div className="relative group overflow-hidden rounded-[40px] shadow-premium bg-black aspect-[4/3] flex flex-col justify-end p-8">
                <img 
                  src={places[0].photos?.[0] || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80'} 
                  alt="Featured" 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-400 rounded-lg">
                    <FireOutlined className="text-[10px] text-black" />
                    <span className="text-[10px] font-black text-black uppercase tracking-widest">Trending Square</span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter leading-none">{places[0].name}</h2>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black text-red-500">///{places[0].what3words}</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    <p className="text-xs font-bold text-gray-300">Precision Verified</p>
                  </div>
                </div>
              </div>
            )}

            {/* List Grid */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-black tracking-tight">Nearby Precision Spots</h3>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{places.length} found</span>
              </div>

              {places.map((p, idx) => (
                <div 
                  key={p.id} 
                  onClick={() => router.push(`/discover/${p.id}`)} 
                  className="flex gap-5 p-5 bg-gray-50/50 border border-gray-100 rounded-[32px] group active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="w-20 h-20 rounded-[22px] overflow-hidden bg-white shadow-sm flex-shrink-0 relative">
                    {p.photos?.[0] ? (
                      <img src={p.photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <EnvironmentOutlined className="text-2xl text-gray-200" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-base font-black text-black truncate mb-1">{p.name}</h4>
                    <div className="flex items-center gap-1.5 mb-3">
                      <CompassOutlined className="text-red-500 text-xs" />
                      <span className="text-xs font-black text-red-600 truncate tracking-tight">///{p.what3words}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(p.tags ?? []).slice(0, 2).map((t: string) => (
                        <span key={t} className="px-3 py-1 bg-white border border-gray-100 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-wider">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {places.length === 0 && (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <RadarChartOutlined className="text-3xl text-gray-200 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-black">Scanning the Grid</h3>
                    <p className="text-sm font-bold text-gray-400 mt-1">Be the first to map a local gem here!</p>
                  </div>
                  <button 
                    onClick={() => router.push('/discover/add')}
                    className="btn btn-black px-8 py-4"
                  >
                    Add Precision Spot
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Precision Tooltip */}
      {tab === 'map' && (
        <div className="absolute bottom-10 left-6 right-6 z-30 animate-slide-up-spring">
          <div className="bg-black text-white p-5 rounded-[28px] shadow-premium border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center flex-shrink-0">
              <GlobalOutlined className="text-2xl text-black" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-yellow-400">Map Mastery</p>
              <p className="text-[11px] font-bold text-gray-400 leading-tight">Every pin represents a verified 3m square. Precision at your fingertips.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
