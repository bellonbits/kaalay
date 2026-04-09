'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserOutlined,
  PhoneOutlined,
  CompassOutlined,
  CarOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { createUser } from '../../lib/api';

const ROLES = [
  {
    id: 'user',
    Icon: CompassOutlined,
    label: 'Standard',
    desc: 'Share location, meet friends, request help',
  },
  {
    id: 'helper',
    Icon: CarOutlined,
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7', overflow: 'hidden' }}>

      {/* ── Hero ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F7F7F7', position: 'relative', overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Decorative circles */}
        {[80, 130, 60, 100, 50, 90].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: s, height: s, borderRadius: '50%',
            background: 'rgba(0,0,0,0.045)',
            top: `${[12, 8, 55, 5, 65, 35][i]}%`,
            left: `${[5, 68, 75, 38, 15, 82][i]}%`,
          }} />
        ))}

        {/* Wordmark */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: '-2px',
            color: '#1A1A1A', lineHeight: 1, fontFamily: 'Inter, sans-serif',
          }}>
            kaalay
          </div>
          <div style={{
            display: 'inline-block', marginTop: 10,
            background: '#FFD600', borderRadius: 50,
            padding: '6px 20px',
            fontSize: 11, fontWeight: 800, letterSpacing: '3px',
            color: '#1A1A1A', textTransform: 'uppercase',
          }}>
            Find · Meet · Move
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '28px 28px 0 0',
        padding: '32px 24px 48px',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', marginBottom: 6 }}>
          Get started
        </h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
          Tell us who you are and how you'll use Kaalay
        </p>

        {/* Role selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {ROLES.map(r => {
            const selected = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                style={{
                  background: selected ? '#1A1A1A' : '#F7F7F7',
                  border: selected ? '2px solid #1A1A1A' : '2px solid #EBEBEB',
                  borderRadius: 18,
                  padding: '18px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.18s ease',
                }}
              >
                {/* Check badge */}
                {selected && (
                  <CheckCircleFilled style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 16, color: '#FFD600',
                  }} />
                )}

                {/* Icon circle */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: selected ? 'rgba(255,214,0,0.15)' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                  border: selected ? '1.5px solid rgba(255,214,0,0.3)' : '1.5px solid #EBEBEB',
                }}>
                  <r.Icon style={{
                    fontSize: 18,
                    color: selected ? '#FFD600' : '#888',
                  }} />
                </div>

                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: selected ? '#FFFFFF' : '#1A1A1A',
                  marginBottom: 4,
                }}>
                  {r.label}
                </div>
                <div style={{
                  fontSize: 11, lineHeight: 1.4,
                  color: selected ? 'rgba(255,255,255,0.55)' : '#999',
                }}>
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Inputs */}
        <form onSubmit={submit}>
          {/* Name */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#F7F7F7', border: '1.5px solid #EBEBEB',
            borderRadius: 14, padding: '14px 16px', marginBottom: 12,
          }}>
            <UserOutlined style={{ fontSize: 17, color: '#BBBBBB', flexShrink: 0 }} />
            <input
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', fontSize: 15, color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif',
              }}
              placeholder="Your full name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#F7F7F7', border: '1.5px solid #EBEBEB',
            borderRadius: 14, padding: '14px 16px', marginBottom: error ? 12 : 20,
          }}>
            <PhoneOutlined style={{ fontSize: 17, color: '#BBBBBB', flexShrink: 0 }} />
            <input
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', fontSize: 15, color: '#1A1A1A',
                fontFamily: 'Inter, sans-serif',
              }}
              placeholder="Phone number"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: 13, color: '#E5383B', fontWeight: 600, marginBottom: 16 }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '17px 24px',
              background: loading ? '#555' : '#1A1A1A',
              color: '#FFFFFF', border: 'none', borderRadius: 16,
              fontSize: 16, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFD600', borderRadius: '50%',
                  animation: 'spin 0.9s linear infinite',
                }} />
                Please wait…
              </>
            ) : (
              <>
                Continue
                <ArrowRightOutlined style={{ fontSize: 15 }} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
