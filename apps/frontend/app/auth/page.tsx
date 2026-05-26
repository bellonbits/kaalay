'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserOutlined,
  MailOutlined,
  CompassOutlined,
  CarOutlined,
  ArrowRightOutlined,
  LoadingOutlined,
  LockOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { loginUser } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const router = useRouter();
  const { login: authLogin, user: existingUser } = useAuth();
  const [identity,   setIdentity] = useState(''); // Phone or Email
  const [password,   setPassword] = useState('');
  const [loading,    setLoading]  = useState(false);
  const [error,      setError]    = useState('');

  useEffect(() => {
    if (existingUser) router.replace('/home');
  }, [existingUser, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identity.length < 5) { setError('Please enter a valid phone or email'); return; }
    if (!password) { setError('Please enter your password'); return; }
    setLoading(true); setError('');
    
    try {
      const res = await loginUser({ phoneNumber: identity, password });
      authLogin(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Invalid credentials. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto no-scroll relative">
      {/* Premium Background Decor */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-400/10 rounded-full blur-[80px]" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-black/5 rounded-full blur-[60px]" />

      <div className="flex-1 flex flex-col px-6 pt-24 pb-10 z-10">
        {/* Cinematic Branding */}
        <div className="mb-16 animate-fade-in">
          <h1 className="text-[64px] font-black tracking-[-4px] text-black leading-none mb-4">
            kaalay
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-400 rounded-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-black">
              Find · Meet · Move
            </span>
          </div>
        </div>

        {/* Login Form */}
        <div className="flex-1 flex flex-col justify-center animate-slide-up-spring">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-black tracking-tight mb-2">Welcome Back</h2>
            <p className="text-gray-400 font-medium">Sign in to continue your journey.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="input-container">
              <PhoneOutlined className="text-xl text-gray-300" />
              <input 
                type="text"
                placeholder="Phone or Email"
                className="flex-1 bg-transparent border-none outline-none text-base font-bold text-black placeholder:text-gray-300"
                value={identity}
                onChange={e => setIdentity(e.target.value)}
              />
            </div>

            <div className="input-container">
              <LockOutlined className="text-xl text-gray-300" />
              <input 
                type="password"
                placeholder="Password"
                className="flex-1 bg-transparent border-none outline-none text-base font-bold text-black placeholder:text-gray-300"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-red-500 text-xs font-bold leading-relaxed">{error}</p>
              </div>
            )}

            <button 
              disabled={identity.length < 5 || loading}
              className="btn btn-black w-full h-16 shadow-premium mt-4"
            >
              {loading ? <LoadingOutlined className="text-xl" /> : (
                <>
                  <span>Sign In</span>
                  <ArrowRightOutlined className="text-sm" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm font-semibold text-gray-400">
              New to Kaalay? {' '}
              <button 
                onClick={() => router.push('/register')} 
                className="text-black font-black underline underline-offset-4 decoration-yellow-400"
              >
                Create Account
              </button>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-8 border-t border-gray-50 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest leading-relaxed">
            By continuing, you agree to Kaalay's <br />
            <span className="text-gray-400">Terms of Service</span> & <span className="text-gray-400">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
