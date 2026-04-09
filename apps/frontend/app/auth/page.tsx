'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser } from '../../lib/api';

const ROLES = [
  {
    id: 'user',
    emoji: '🧭',
    label: 'Standard',
    desc: 'Share location, meet friends, request help',
  },
  {
    id: 'helper',
    emoji: '🚗',
    label: 'Driver / Helper',
    desc: 'Accept requests, assist people nearby',
  },
];

export default function AuthPage() {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [role,    setRole]    = useState('user');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError('Please fill in both fields'); return; }
    setLoading(true); setError('');
    try {
      const user = await createUser({ fullName: name.trim(), phoneNumber: phone.trim(), role });
      localStorage.setItem('kaalay_user', JSON.stringify(user));
    } catch {
      localStorage.setItem('kaalay_user', JSON.stringify({
        id: `local-${Date.now()}`, fullName: name.trim(), phoneNumber: phone.trim(), role,
      }));
    } finally {
      setLoading(false);
      router.push('/home');
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">

      {/* Hero illustration area */}
      <div className="flex-1 flex flex-col items-center justify-end pb-8 px-6 bg-bg relative overflow-hidden">
        {/* Abstract map dots */}
        {[...Array(14)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-ink/5"
            style={{
              width: `${12 + (i * 7) % 20}px`,
              height: `${12 + (i * 7) % 20}px`,
              top: `${10 + (i * 29) % 75}%`,
              left: `${5 + (i * 37) % 85}%`,
            }}
          />
        ))}
        {/* Wordmark */}
        <div className="relative z-10 text-center">
          <div className="text-5xl font-black tracking-tighter text-ink mb-1">
            kaalay
          </div>
          <div
            className="inline-block text-xs font-bold tracking-[3px] uppercase px-3 py-1 rounded-full"
            style={{ background: '#FFD600', color: '#1A1A1A' }}
          >
            Find · Meet · Move
          </div>
        </div>
      </div>

      {/* Form sheet */}
      <div className="bg-surface rounded-t-3xl px-6 pt-8 pb-10 shadow-sheet slide-up">
        <h2 className="text-2xl font-black text-ink mb-1">Get started</h2>
        <p className="text-sm text-muted mb-6">Tell us who you are and how you'll use Kaalay</p>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {ROLES.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                role === r.id ? 'border-ink bg-ink/5' : 'border-border bg-bg'
              }`}
            >
              <div className="text-2xl mb-2">{r.emoji}</div>
              <div className="text-sm font-bold text-ink">{r.label}</div>
              <div className="text-xs text-muted mt-0.5 leading-snug">{r.desc}</div>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Name */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-lg">👤</span>
            <input
              className="input pl-11"
              placeholder="Your full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          {/* Phone */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">📱</span>
            <input
              className="input pl-11"
              placeholder="Phone number"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          <button type="submit" disabled={loading}
            className="btn btn-black w-full mt-1">
            {loading ? 'Please wait…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
}
