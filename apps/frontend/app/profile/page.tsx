'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserOutlined, PhoneOutlined, MailOutlined, SafetyOutlined,
  LogoutOutlined, EditOutlined, CameraOutlined, ArrowLeftOutlined,
  CheckOutlined, RightOutlined, LoadingOutlined, CarOutlined,
  IdcardOutlined, CloseOutlined, WalletOutlined, StarFilled,
  GlobalOutlined, AppstoreOutlined, SettingOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, api } from '../../lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, checkAuth } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Driver Registration State
  const [showDriverReg, setShowDriverReg] = useState(false);
  const [regData, setRegData] = useState({
    vehicleCategory: 'economy',
    vehicleModel: '',
    vehicleColor: '',
    licensePlate: '',
    nationalIdUrl: '',
    drivingLicenseUrl: ''
  });
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (user) setName(user.fullName);
  }, [user]);

  const handleUpdate = async () => {
    if (!name.trim() || name === user?.fullName) {
      setIsEditing(false);
      return;
    }
    setLoading(true);
    try {
      await updateProfile({ fullName: name.trim() });
      await checkAuth();
      setIsEditing(false);
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDriver = async () => {
    if (!regData.vehicleModel || !regData.licensePlate || !regData.nationalIdUrl || !regData.drivingLicenseUrl) {
      alert("Please fill in all required fields and upload documents.");
      return;
    }
    setRegLoading(true);
    try {
      await api.post('/drivers/register', regData);
      await checkAuth();
      setShowDriverReg(false);
      router.push('/home');
    } catch (err: any) {
      alert(err.response?.data?.detail || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto overflow-x-hidden no-scroll font-outfit relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-black to-white/0 opacity-[0.03] pointer-events-none" />
      <div className="absolute top-20 -right-20 w-64 h-64 bg-yellow-400/5 rounded-full blur-[80px]" />
      
      {/* Premium Header */}
      <div className="pt-12 px-6 pb-5 flex items-center justify-between z-30 animate-fade-in sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-50/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/home')} 
            className="w-11 h-11 bg-black rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-premium"
          >
            <ArrowLeftOutlined className="text-lg text-white" />
          </button>
          <h1 className="text-2xl font-black text-black tracking-tight">Command Center</h1>
        </div>
        <button 
          onClick={logout}
          className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-transform"
        >
          <LogoutOutlined />
          <span>Exit</span>
        </button>
      </div>

      <div className="px-6 pb-40 space-y-8 animate-slide-up-spring">
        {/* Cinematic Identity Card */}
        <div className="relative pt-8 pb-10 px-6 rounded-[40px] bg-black shadow-premium text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 rounded-[32px] bg-yellow-400 flex items-center justify-center text-4xl font-black text-black shadow-premium ring-4 ring-white/10">
              {user.fullName.charAt(0)}
            </div>
            <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
              <CameraOutlined className="text-black text-lg" />
            </button>
          </div>

          <div className="space-y-2">
            {isEditing ? (
              <div className="flex items-center justify-center gap-3">
                <input 
                  autoFocus
                  disabled={loading}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={handleUpdate}
                  onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                  className="bg-white/5 border-b-2 border-yellow-400 text-white text-2xl font-black text-center outline-none w-full max-w-[200px]"
                />
                {loading ? <LoadingOutlined className="text-yellow-400" /> : <CheckOutlined className="text-green-400" />}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-2xl font-black text-white tracking-tight">{user.fullName}</h2>
                <button onClick={() => setIsEditing(true)} className="text-white/30 hover:text-yellow-400 transition-colors">
                  <EditOutlined className="text-lg" />
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2">
              <div className="px-3 py-1 bg-white/10 rounded-full flex items-center gap-1.5">
                <SafetyCertificateOutlined className="text-[10px] text-yellow-400" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest">Verified {user.role}</span>
              </div>
              <div className="flex items-center gap-1">
                <StarFilled className="text-yellow-400 text-[10px]" />
                <span className="text-xs font-black text-white">5.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Command Dashboard */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 flex flex-col justify-between aspect-square">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <WalletOutlined className="text-black text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Impact</p>
              <h3 className="text-2xl font-black text-black">KES 0</h3>
            </div>
          </div>
          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 flex flex-col justify-between aspect-square">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <GlobalOutlined className="text-black text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Precision Pts</p>
              <h3 className="text-2xl font-black text-black">124</h3>
            </div>
          </div>
        </div>

        {/* Settings Hub */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-black uppercase tracking-[2px] ml-2">Coordination Hub</h3>
          <div className="bg-white border-2 border-gray-50 rounded-[40px] p-2 space-y-1">
            <SettingsRow icon={<PhoneOutlined />} label="Phone" value={user.phoneNumber} />
            <SettingsRow icon={<MailOutlined />} label="Email" value={user.email || 'Complete profile'} />
            <SettingsRow icon={<SafetyOutlined />} label="Trust & Safety" value="Verified" />
            <SettingsRow icon={<AppstoreOutlined />} label="History" value="View all" border={false} />
          </div>
        </div>

        {/* Become Driver Action */}
        {user.role === 'rider' && (
          <button 
            onClick={() => setShowDriverReg(true)}
            className="w-full p-8 bg-yellow-400 rounded-[40px] shadow-premium flex items-center gap-6 group active:scale-[0.98] transition-all"
          >
            <div className="w-16 h-16 rounded-[24px] bg-black flex items-center justify-center flex-shrink-0 group-hover:rotate-12 transition-transform">
              <CarOutlined className="text-3xl text-yellow-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-xl font-black text-black leading-tight">Master the Grid</h3>
              <p className="text-sm font-bold text-black/60">Register as a driver and earn rewards for precision.</p>
            </div>
            <RightOutlined className="text-black text-xl" />
          </button>
        )}
      </div>

      {/* Driver Registration Modal */}
      {showDriverReg && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end animate-fade-in">
          <div className="w-full bg-[#F8F9FA] rounded-t-[50px] max-h-[90vh] flex flex-col animate-slide-up-spring overflow-hidden shadow-2xl">
            <div className="p-8 flex items-center justify-between bg-white border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-black text-black tracking-tight">Become a Driver</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Onboarding Flow</p>
              </div>
              <button 
                onClick={() => setShowDriverReg(false)} 
                className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
              >
                <CloseOutlined className="text-black" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scroll p-8 space-y-8 pb-12">
              {/* Category Picker */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Vehicle Category</p>
                <div className="flex gap-4 overflow-x-auto no-scroll pb-2">
                  {['economy', 'bike', 'xl', 'pro'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setRegData({...regData, vehicleCategory: cat})}
                      className={`px-8 py-4 rounded-[24px] font-black text-sm uppercase tracking-wider transition-all border-2 ${regData.vehicleCategory === cat ? 'bg-black text-white border-black shadow-premium' : 'bg-white text-gray-300 border-gray-100'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Cards */}
              <div className="bg-white rounded-[40px] p-8 border-2 border-gray-50 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <SettingOutlined className="text-yellow-400 text-xl" />
                  <h3 className="text-lg font-black text-black">Vehicle Details</h3>
                </div>
                <div className="space-y-4">
                  <div className="input-container !bg-gray-50">
                    <input placeholder="Vehicle Model (e.g. Toyota Vitz)" value={regData.vehicleModel} onChange={e => setRegData({...regData, vehicleModel: e.target.value})} className="flex-1 bg-transparent border-none outline-none text-sm font-bold" />
                  </div>
                  <div className="input-container !bg-gray-50">
                    <input placeholder="Vehicle Color" value={regData.vehicleColor} onChange={e => setRegData({...regData, vehicleColor: e.target.value})} className="flex-1 bg-transparent border-none outline-none text-sm font-bold" />
                  </div>
                  <div className="input-container !bg-gray-50">
                    <input placeholder="License Plate (e.g. KAA 123X)" value={regData.licensePlate} onChange={e => setRegData({...regData, licensePlate: e.target.value})} className="flex-1 bg-transparent border-none outline-none text-sm font-bold" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] p-8 border-2 border-gray-50 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <IdcardOutlined className="text-yellow-400 text-xl" />
                  <h3 className="text-lg font-black text-black">Identification</h3>
                </div>
                <div className="space-y-4">
                  <div className="input-container !bg-gray-50">
                    <input placeholder="National ID Image URL" value={regData.nationalIdUrl} onChange={e => setRegData({...regData, nationalIdUrl: e.target.value})} className="flex-1 bg-transparent border-none outline-none text-sm font-bold" />
                  </div>
                  <div className="input-container !bg-gray-50">
                    <input placeholder="Driving License Image URL" value={regData.drivingLicenseUrl} onChange={e => setRegData({...regData, drivingLicenseUrl: e.target.value})} className="flex-1 bg-transparent border-none outline-none text-sm font-bold" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white border-t border-gray-100">
              <button 
                onClick={handleRegisterDriver}
                disabled={regLoading}
                className="btn btn-black w-full py-5 shadow-premium flex items-center justify-center gap-3"
              >
                {regLoading ? <LoadingOutlined className="text-yellow-400" /> : <span>SUBMIT APPLICATION</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ icon, label, value, border = true }: { icon: any, label: string, value: string, border?: boolean }) {
  return (
    <div className={`flex items-center gap-5 p-4 group cursor-pointer active:bg-gray-50 transition-colors ${border ? 'border-b border-gray-50' : ''}`}>
      <div className="w-12 h-12 rounded-[18px] bg-gray-50 flex items-center justify-center text-black text-lg group-hover:bg-yellow-400 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-black text-black group-hover:translate-x-1 transition-transform">{value}</p>
      </div>
      <RightOutlined className="text-gray-200 text-xs" />
    </div>
  );
}
