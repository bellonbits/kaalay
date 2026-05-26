'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined, EnvironmentOutlined, CameraOutlined,
  TagOutlined, LoadingOutlined, CheckOutlined,
  ShopOutlined, InfoCircleOutlined, FireFilled
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
      await createPlace({
        name,
        description: desc || undefined,
        lat: position.lat,
        lng: position.lng,
        words: w3w,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
      <div className="h-full flex flex-col items-center justify-center bg-green-50 px-8 text-center animate-fade-in font-outfit">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-8 shadow-lg shadow-green-200">
          <CheckOutlined className="text-3xl text-white" />
        </div>
        <h2 className="text-3xl font-black text-black mb-2 tracking-tight">Spot Mapped!</h2>
        <p className="text-green-700 font-bold max-w-[240px]">You've just helped make your community more searchable on the precision grid.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white font-outfit relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-yellow-400/5 rounded-full blur-[100px]" />

      {/* Header */}
      <div className="pt-12 px-6 pb-5 bg-white/90 backdrop-blur-xl z-30 sticky top-0 border-b border-gray-50 flex items-center gap-4">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 bg-black rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-premium"
        >
          <ArrowLeftOutlined className="text-lg text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight leading-none">Register Spot</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Grid Mapping Tool</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scroll p-6 space-y-8 pb-40">
        {/* Name */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
            <ShopOutlined className="text-xs" />
            Place Name
          </label>
          <div className="input-container !bg-gray-50">
            <input 
              required
              placeholder="e.g. Mama Mboga's Fruit Stall"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black"
            />
          </div>
        </div>

        {/* w3w status Card */}
        <div className="p-6 bg-black rounded-[32px] shadow-premium flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/5 rounded-full -mr-12 -mt-12 blur-xl" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <EnvironmentOutlined className="text-xl text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Active 3m Grid</p>
            <p className="text-lg font-black text-white tracking-tight">{w3w ? `///${w3w}` : 'Detecting...'}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
            <InfoCircleOutlined className="text-xs" />
            Vibe & Details
          </label>
          <div className="input-container !bg-gray-50 !h-auto py-4">
            <textarea 
              rows={3}
              placeholder="What makes this place special?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black resize-none"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
            <TagOutlined className="text-xs" />
            Tags (comma separated)
          </label>
          <div className="input-container !bg-gray-50">
            <input 
              placeholder="food, market, hidden-gem"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black"
            />
          </div>
        </div>

        {/* Image Picker Placeholder */}
        <div className="w-full h-32 rounded-[32px] border-2 border-dashed border-gray-100 bg-gray-50/50 flex flex-col items-center justify-center gap-2 group cursor-pointer active:scale-[0.98] transition-all">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:rotate-12 transition-transform">
            <CameraOutlined className="text-gray-300 text-lg" />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Add Discovery Photos</span>
        </div>

        {/* Submit Button - Now scrollable and prominent */}
        <div className="pt-4">
          <button 
            type="submit"
            disabled={!name || !w3w || loading}
            className={`btn btn-black w-full h-16 py-0 flex items-center justify-center gap-3 shadow-premium transition-all ${(!name || !w3w) ? 'opacity-20 grayscale cursor-not-allowed' : 'opacity-100 hover:scale-[1.02]'}`}
          >
            {loading ? <LoadingOutlined /> : <CheckOutlined className="text-yellow-400" />}
            <span className="text-base font-black tracking-widest uppercase">Confirm Registration</span>
          </button>
          <p className="text-[10px] font-bold text-gray-400 text-center mt-6 uppercase tracking-[2px]">By registering you agree to the grid guidelines</p>
        </div>
      </form>
    </div>
  );
}
