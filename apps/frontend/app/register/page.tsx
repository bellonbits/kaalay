'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  CompassOutlined,
  CarOutlined,
  ArrowLeftOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { registerUser } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { id: 'rider', Icon: CompassOutlined, label: 'Rider', desc: 'Find & Share location' },
  { id: 'driver', Icon: CarOutlined, label: 'Driver', desc: 'Help others & Earn' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'rider'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.fullName || !form.phoneNumber || !form.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        email: form.email || undefined,
        password: form.password,
        role: form.role
      });
      authLogin(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto no-scroll relative">
      {/* Background Decor */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-400/5 rounded-full blur-[80px]" />

      {/* Header */}
      <div className="pt-16 px-6 pb-8 flex items-center gap-4 z-10 animate-fade-in">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 glass rounded-2xl flex items-center justify-center shadow-premium active:scale-90 transition-transform"
        >
          <ArrowLeftOutlined className="text-lg text-black" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">Create Account</h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Join the community</p>
        </div>
      </div>

      <div className="px-6 flex-1 z-10 animate-slide-up-spring pb-32">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Role Toggle */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">I want to be a:</p>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(r => (
                <button 
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, role: r.id })}
                  className={`p-5 rounded-[24px] text-left transition-all duration-300 border-2 ${
                    form.role === r.id 
                    ? 'bg-black border-black shadow-premium' 
                    : 'bg-gray-50 border-transparent'
                  }`}
                >
                  <r.Icon className={`text-xl mb-3 ${form.role === r.id ? 'text-white' : 'text-gray-300'}`} />
                  <div className={`text-sm font-black ${form.role === r.id ? 'text-white' : 'text-black'}`}>{r.label}</div>
                  <p className={`text-[10px] font-bold mt-1 leading-tight opacity-60 ${form.role === r.id ? 'text-gray-400' : 'text-gray-500'}`}>
                    {r.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Profile Info</p>
              <div className="space-y-4">
                <Input icon={<UserOutlined />} placeholder="Full Name" value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} />
                <Input icon={<PhoneOutlined />} placeholder="Phone Number" value={form.phoneNumber} onChange={v => setForm({ ...form, phoneNumber: v })} />
                <Input icon={<MailOutlined />} placeholder="Email (Optional)" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Security</p>
              <div className="space-y-4">
                <Input type="password" icon={<LockOutlined />} placeholder="Password" value={form.password} onChange={v => setForm({ ...form, password: v })} />
                <Input type="password" icon={<LockOutlined />} placeholder="Confirm Password" value={form.confirmPassword} onChange={v => setForm({ ...form, confirmPassword: v })} />
              </div>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-red-500 text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <button 
            disabled={loading}
            className="btn btn-black w-full h-16 shadow-premium"
          >
            {loading ? <LoadingOutlined className="text-xl" /> : 'Complete Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center pb-8">
          <p className="text-sm font-semibold text-gray-400">
            Already have an account? {' '}
            <button 
              onClick={() => router.push('/auth')} 
              className="text-black font-black underline underline-offset-4 decoration-yellow-400"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Input({ icon, placeholder, value, onChange, type = 'text' }: { icon: any, placeholder: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="input-container">
      <div className="text-xl text-gray-300">{icon}</div>
      <input 
        type={type}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-base font-bold text-black placeholder:text-gray-300"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
