'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PhoneOutlined,
  LoadingOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { loginUser, registerUser } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const VEHICLE_CATEGORIES = [
  { id: 'economy', label: 'Economy Taxi', icon: '🚗' },
  { id: 'pro', label: 'Pro Bike', icon: '🏍️' },
  { id: 'help', label: 'Helper Vehicle', icon: '🏥' }
];

export default function AuthPage() {
  const router = useRouter();
  const { login: authLogin, user: existingUser } = useAuth();
  
  // Navigation flow steps: 'phone' | 'register'
  const [step, setStep] = useState<'phone' | 'register'>('phone');
  
  // Fields state
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [vehicleCategory, setVehicleCategory] = useState('economy');
  const [licensePlate, setLicensePlate] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingUser) router.replace('/home');
  }, [existingUser, router]);

  // Phone auto-formatting e.g. +254 712 345678
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Auto-prepend +254 country code if they start typing numbers
    if (value && !value.startsWith('+')) {
      if (value.startsWith('0')) value = value.substring(1);
      value = '+254' + value;
    }
    
    // Only allow plus, numbers, and spaces
    value = value.replace(/[^0-9+ ]/g, '');
    setPhone(value);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length < 12) {
      setError('Please enter a valid phone number (e.g. +254 712 345 678)');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await loginUser(cleanPhone);
      if (res.isNewUser) {
        setStep('register');
      } else {
        // Authenticate existing user
        authLogin(res.user, res.accessToken, res.refreshToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (role === 'driver' && !licensePlate.trim()) {
      setError('Please enter your vehicle license plate number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const payload = {
        phoneNumber: cleanPhone,
        fullName: fullName.trim(),
        role,
        email: email.trim() ? email.trim() : undefined,
        vehicleCategory: role === 'driver' ? vehicleCategory : undefined,
        licensePlate: role === 'driver' ? licensePlate.toUpperCase().trim() : undefined
      };
      
      const res = await registerUser(payload);
      authLogin(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto no-scroll relative justify-between pb-10">
      {/* Premium Cinematic Background Elements */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-yellow-400/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#000080]/5 rounded-full blur-[80px] pointer-events-none" />

      {/* STEP 1: PHONE VIEW */}
      {step === 'phone' && (
        <div className="flex-1 flex flex-col px-6 pt-24 justify-between z-10">
          
          {/* Cinematic Branding (Centered in top third) */}
          <div className="flex flex-col items-center justify-center pt-8 text-center animate-fade-in">
            <h1 className="text-[68px] font-black tracking-[-5px] text-black leading-none mb-4 select-none">
              kaalay
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-400 rounded-lg shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-[2px] text-black">
                Precision Location Booking
              </span>
            </div>
          </div>

          {/* Bottom Inputs and Actions Container */}
          <div className="w-full mt-16 max-w-md mx-auto space-y-8 animate-slide-up-spring">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <h2 className="text-3xl font-black text-black tracking-tight mb-2">Get Started</h2>
                <p className="text-gray-400 text-sm font-semibold">Enter your phone number to proceed.</p>
              </div>

              <div className={`input-container h-14 ${error ? 'border-red-500' : 'focus-within:border-black'}`}>
                <PhoneOutlined className="text-xl text-gray-400" />
                <input
                  type="tel"
                  placeholder="+254 712 345678"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="flex-1 bg-transparent border-none outline-none text-base font-black text-black placeholder:text-gray-300 tracking-wide"
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs font-bold flex items-center gap-1.5 px-1">
                  <InfoCircleOutlined />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || phone.length < 12}
                className="btn btn-black w-full h-14 shadow-premium select-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
              >
                {loading ? <LoadingOutlined className="text-lg" /> : (
                  <>
                    <span className="text-sm font-black uppercase tracking-wider">Proceed to Entrance</span>
                    <ArrowRightOutlined className="text-xs" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: REGISTER / PROFILE SETUP VIEW */}
      {step === 'register' && (
        <div className="w-full max-w-md mx-auto px-6 pt-16 z-10 animate-fade-in">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-black tracking-tight mb-2">Create Account</h2>
            <p className="text-gray-400 text-sm font-semibold">Your phone number is verified. Complete your profile.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            
            {/* Display verified phone number */}
            <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-2xl">
              <CheckCircleOutlined className="text-green-500 text-base shrink-0" />
              <span className="text-xs font-black text-green-700">{phone} is Verified</span>
            </div>

            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#888] tracking-widest uppercase">Full Name</label>
              <div className={`input-container h-13 ${error && !fullName.trim() ? 'border-red-500' : ''}`}>
                <UserOutlined className="text-lg text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setError(''); }}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-black text-black placeholder:text-gray-300"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email Input (Optional) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#888] tracking-widest uppercase">Email (Optional)</label>
              <div className="input-container h-13">
                <MailOutlined className="text-lg text-gray-400" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-black text-black placeholder:text-gray-300"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Role Selector Pills */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#888] tracking-widest uppercase">Select App Role</label>
              <div className="flex bg-gray-50 border border-gray-100 rounded-full p-1 h-14">
                <button
                  type="button"
                  onClick={() => { setRole('rider'); setError(''); }}
                  className={`flex-1 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                    role === 'rider' ? 'bg-[#000080] text-white shadow-sm' : 'text-gray-400 bg-transparent'
                  }`}
                  disabled={loading}
                >
                  🚴 Rider Mode
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('driver'); setError(''); }}
                  className={`flex-1 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                    role === 'driver' ? 'bg-[#000080] text-white shadow-sm' : 'text-gray-400 bg-transparent'
                  }`}
                  disabled={loading}
                >
                  🚗 Driver / Helper
                </button>
              </div>
            </div>

            {/* Driver Extras */}
            {role === 'driver' && (
              <div className="space-y-4 pt-2 border-t border-gray-50 animate-slide-down">
                
                {/* Vehicle Category Selector Cards */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#888] tracking-widest uppercase">Vehicle Category</label>
                  <div className="flex gap-2">
                    {VEHICLE_CATEGORIES.map(category => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setVehicleCategory(category.id)}
                        className={`flex-1 p-3.5 rounded-2xl text-center border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${
                          vehicleCategory === category.id
                            ? 'bg-black border-black text-white shadow-md'
                            : 'bg-gray-50 border-transparent text-gray-500'
                        }`}
                      >
                        <span className="text-xl">{category.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{category.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* License Plate Input */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#888] tracking-widest uppercase">License Plate Number</label>
                  <div className={`input-container h-13 ${error && !licensePlate.trim() ? 'border-red-500' : ''}`}>
                    <SafetyCertificateOutlined className="text-lg text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. KDG 123A"
                      value={licensePlate}
                      onChange={e => { setLicensePlate(e.target.value.toUpperCase()); setError(''); }}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-black text-black placeholder:text-gray-300 uppercase tracking-widest"
                      maxLength={10}
                      disabled={loading}
                    />
                  </div>
                </div>

              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs font-bold flex items-center gap-1.5 px-1 justify-center">
                <InfoCircleOutlined />
                {error}
              </p>
            )}

            {/* Complete Register Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-black w-full h-14 shadow-premium mt-6 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              {loading ? <LoadingOutlined className="text-lg" /> : (
                <>
                  <span className="text-sm font-black uppercase tracking-wider">Complete Registration</span>
                  <ArrowRightOutlined className="text-xs" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Brand Footer Info */}
      <div className="px-6 text-center shrink-0 w-full max-w-md mx-auto mt-8">
        <p className="text-[9px] text-gray-300 font-bold uppercase tracking-[1.5px] leading-relaxed select-none">
          By signing in, you agree to Kaalay's <br />
          <span className="text-gray-400">Terms of Service</span> & <span className="text-gray-400">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
