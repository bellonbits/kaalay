'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser } from '../../lib/api';
import Image from 'next/image';

const ROLES = [
  { id: 'user', label: 'Standard User', desc: 'Share location, request help, meet friends', icon: '/person.png' },
  { id: 'helper', label: 'Helper / Driver', desc: 'View nearby requests, assist people, offer rides', icon: '/out.png' },
];

export default function AuthPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await createUser({ fullName: name.trim(), phoneNumber: phone.trim(), role });
      localStorage.setItem('kaalay_user', JSON.stringify(user));
      router.push('/home');
    } catch {
      // Fallback for dev — store locally without backend
      const localUser = { id: `local-${Date.now()}`, fullName: name, phoneNumber: phone, role };
      localStorage.setItem('kaalay_user', JSON.stringify(localUser));
      router.push('/home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0F0F0F] overflow-hidden">
      {/* Hero */}
      <div className="relative flex-1 overflow-hidden">
        <Image src="/get-started.png" alt="" fill className="object-cover opacity-30" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0F0F0F]/60 to-[#0F0F0F]" />
        <div className="absolute bottom-8 left-6 right-6">
          <h1 className="text-4xl font-black leading-tight">
            kaa<span className="text-[#A8D83F]">lay</span>
          </h1>
          <p className="text-[#8E8E9A] mt-2 text-base">Find. Meet. Move. Together.</p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-[#141414] rounded-t-3xl px-6 pt-8 pb-10 slide-up">
        <h2 className="text-xl font-bold mb-6">Get started</h2>

        {/* Role picker */}
        <div className="flex gap-3 mb-6">
          {ROLES.map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all ${
                role === r.id
                  ? 'border-[#A8D83F] bg-[#A8D83F]/10'
                  : 'border-[#2A2A2A] bg-[#1A1A1A]'
              }`}
            >
              <img src={r.icon} alt="" className="w-6 h-6 mb-2 opacity-80" />
              <div className="text-sm font-700 font-bold">{r.label}</div>
              <div className="text-xs text-[#555] mt-1 leading-tight">{r.desc}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3">
            <img src="/profile.png" alt="" className="w-5 h-5 opacity-40" />
            <input
              className="flex-1 bg-transparent text-white placeholder-[#555] outline-none text-sm"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3">
            <img src="/target.png" alt="" className="w-5 h-5 opacity-40" />
            <input
              className="flex-1 bg-transparent text-white placeholder-[#555] outline-none text-sm"
              placeholder="Phone number"
              value={phone}
              type="tel"
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#A8D83F] text-[#0F0F0F] font-bold text-base mt-2 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Loading...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
