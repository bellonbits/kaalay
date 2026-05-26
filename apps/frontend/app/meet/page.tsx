'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, TeamOutlined, CopyOutlined, CheckOutlined,
  EnvironmentOutlined, UserOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { createSession, convertToCoordinates, convertTo3wa } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface GroupMember {
  memberId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  lastSeen: number;
}

interface Destination { lat: number; lng: number; label?: string; w3w?: string }

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const MEMBER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F7DC6F', '#82E0AA'];
const memberColor = (idx: number) => MEMBER_COLORS[idx % MEMBER_COLORS.length];

export default function MeetPage() {
  const router    = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();

  const [step,     setStep]     = useState<'setup' | 'live'>('setup');
  const [tab,      setTab]      = useState<'create' | 'join'>('create');
  const [name,     setName]     = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [showDestSheet, setShowDestSheet] = useState(false);
  const [destInput,  setDestInput]  = useState('');
  const [destLoading, setDestLoading] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [starting, setStarting] = useState(false);
  const [sheetH,   setSheetH]   = useState<'peek' | 'half' | 'full'>('half');
  const [arrivals, setArrivals] = useState<{ name: string; timestamp: number }[]>([]);
  const [arrived,  setArrived]  = useState(false);

  const membersRef = useRef(new Map<string, GroupMember>());
  const myId       = useRef('');
  const joinedRef  = useRef(false);
  const broadRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(() => {
    setMembersList(Array.from(membersRef.current.values()));
  }, []);

  // Load user from storage, init myId and pre-fill name
  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (u) {
      const parsed = JSON.parse(u);
      setName(parsed.fullName ?? '');
      myId.current = parsed.id ?? Math.random().toString(36).slice(2);
    } else {
      myId.current = Math.random().toString(36).slice(2);
    }
    // Pre-fill code from URL
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setJoinCode(c.toUpperCase()); setTab('join'); }
  }, []);

  // Register socket listeners when live
  useEffect(() => {
    if (step !== 'live' || !activeCode) return;
    const s = socketRef.current;
    if (!s) return;

    const onMemberList = (list: GroupMember[]) => {
      membersRef.current.clear();
      list.filter(m => m.memberId !== myId.current).forEach(m => membersRef.current.set(m.memberId, m));
      sync();
    };
    const onMemberJoined = (m: GroupMember) => {
      if (m.memberId === myId.current) return;
      membersRef.current.set(m.memberId, m);
      sync();
    };
    const onMemberLeft = ({ memberId }: { memberId: string }) => {
      membersRef.current.delete(memberId);
      sync();
    };
    const onMemberLocation = (u: { memberId: string; lat: number; lng: number; accuracy?: number; heading?: number }) => {
      const existing = membersRef.current.get(u.memberId);
      if (existing) {
        membersRef.current.set(u.memberId, { ...existing, ...u, lastSeen: Date.now() });
        sync();
      }
    };
    const onDestination = (d: { lat: number; lng: number; label?: string }) => {
      convertTo3wa(d.lat, d.lng).then(r => setDestination({ ...d, w3w: r.what3words })).catch(() => setDestination(d));
    };

    const onMemberArrived = (d: { name: string; timestamp: number }) => {
      // Show toast or update list
      setArrivals(prev => [d, ...prev].slice(0, 3));
    };

    s.on('member-list',    onMemberList);
    s.on('member-joined',  onMemberJoined);
    s.on('member-left',    onMemberLeft);
    s.on('member-location', onMemberLocation);
    s.on('destination',    onDestination);
    s.on('member-arrived',  onMemberArrived);

    return () => {
      joinedRef.current = false;
      s.emit('leave-group', { code: activeCode, memberId: myId.current });
      s.off('member-list',    onMemberList);
      s.off('member-joined',  onMemberJoined);
      s.off('member-left',    onMemberLeft);
      s.off('member-location', onMemberLocation);
      s.off('destination',    onDestination);
      s.off('member-arrived',  onMemberArrived);
    };
  }, [step, activeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join group once position is ready
  useEffect(() => {
    if (step !== 'live' || !activeCode || !position || joinedRef.current) return;
    joinedRef.current = true;
    socketRef.current?.emit('join-group', {
      code: activeCode, memberId: myId.current, name,
      lat: position.lat, lng: position.lng,
      accuracy: position.accuracy, heading: position.heading,
    });
  }, [step, activeCode, position]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast interval
  useEffect(() => {
    if (step !== 'live' || !activeCode || !position) return;
    broadRef.current = setInterval(() => {
      socketRef.current?.emit('group-location', {
        code: activeCode, memberId: myId.current,
        lat: position.lat, lng: position.lng,
        accuracy: position.accuracy, heading: position.heading,
      });
    }, 3000);
    return () => { if (broadRef.current) clearInterval(broadRef.current); };
  }, [step, activeCode, position]); // eslint-disable-line react-hooks/exhaustive-deps

  const startGroup = async () => {
    if (!position || !name.trim()) return;
    setStarting(true);
    try {
      const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
      const s = await createSession({
        latitude: position.lat, longitude: position.lng,
        accuracy: position.accuracy,
        requestType: 'meetup', visibility: 'link',
        userId: user.id,
      });
      setActiveCode(s.shareCode);
      setStep('live');
    } catch {
      const code = 'KAA-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      setActiveCode(code);
      setStep('live');
    } finally { setStarting(false); }
  };

  const joinGroup = () => {
    if (!joinCode.trim() || !name.trim()) return;
    setActiveCode(joinCode.trim().toUpperCase());
    setStep('live');
  };

  const leave = () => {
    if (broadRef.current) clearInterval(broadRef.current);
    router.push('/home');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meet?code=${activeCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const txt = `Join my group location session on Kaalay!\n\nCode: ${activeCode}\nLink: ${window.location.origin}/meet?code=${activeCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  const pinMyLocation = () => {
    if (!position) return;
    socketRef.current?.emit('set-destination', { code: activeCode, lat: position.lat, lng: position.lng, label: `${name}'s location` });
    setShowDestSheet(false);
  };

  const submitDestination = async () => {
    const words = destInput.trim().replace(/^\/+/, '');
    if (!words) return;
    setDestLoading(true);
    try {
      const { latitude, longitude, what3words } = await convertToCoordinates(words);
      socketRef.current?.emit('set-destination', { code: activeCode, lat: latitude, lng: longitude, label: `///${what3words}` });
      setDestInput('');
      setShowDestSheet(false);
    } catch { /* silent */ } finally { setDestLoading(false); }
  };

  const otherMembers  = membersList;
  const sheetTranslate = sheetH === 'peek' ? 'calc(100% - 120px)' : sheetH === 'half' ? 'calc(100% - 360px)' : '0px';

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy }] : []),
    ...otherMembers.map(m => ({ lat: m.lat, lng: m.lng, type: 'tracked' as const, label: m.name })),
    ...(destination ? [{ lat: destination.lat, lng: destination.lng, type: 'request' as const, label: destination.label ?? 'Meeting point' }] : []),
  ];

  const center = position ?? { lat: -1.29, lng: 36.82 };

  return (
    <div className="h-full relative bg-[#F7F7F7] overflow-hidden font-outfit">
      {/* ── LIVE VIEW (Always Mounted) ────────────────────────────────────── */}
      <div className={`absolute inset-0 transition-opacity duration-500 z-0 ${step === 'live' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 z-0">
          <MapBase center={center} zoom={14} markers={markers}
            routeTo={destination ?? undefined} className="w-full h-full" />
        </div>

        {/* Back button */}
        <button onClick={leave} className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md border-none cursor-pointer">
          <ArrowLeftOutlined className="text-[15px] text-[#1A1A1A]" />
        </button>

        {/* Top pill: code + member count */}
        <div className="absolute top-12 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 border border-[#EBEBEB] shadow-sm flex items-center gap-2.5">
            <TeamOutlined className="text-xs text-[#1A1A1A]" />
            <span className="text-xs font-black tracking-widest text-[#1A1A1A]">{activeCode}</span>
            <span className="text-[11px] text-[#888]">{otherMembers.length + 1} here</span>
          </div>
        </div>

        {/* Bottom sheet */}
        <div 
          className="absolute bottom-0 left-0 right-0 z-20 h-[75%] bg-white rounded-t-[28px] shadow-sheet flex flex-col transition-transform duration-300 ease-out pointer-events-auto"
          style={{ transform: `translateY(${sheetTranslate})` }}
        >
          {/* Handle */}
          <div className="flex justify-center py-3 cursor-pointer shrink-0" onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}>
            <div className="w-9 h-1 rounded-full bg-[#EBEBEB]" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-10 no-scroll">
            {/* Invite row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] text-[#888] font-bold tracking-widest uppercase mb-0.5">Session code</p>
                <p className="text-lg font-black tracking-widest text-[#1A1A1A]">{activeCode}</p>
              </div>
              <button onClick={copyCode} className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${copied ? 'bg-[#F0FDF4] text-[#16A34A] border-[1.5px] border-[#86EFAC]' : 'bg-[#F7F7F7] text-[#1A1A1A] border-[1.5px] border-[#EBEBEB]'}`}>
                {copied ? <CheckOutlined /> : <CopyOutlined />}
                {copied ? 'Copied!' : 'Invite'}
              </button>
              <button onClick={shareWhatsApp} className="px-3.5 py-2.5 bg-[#25D366] text-white border-none rounded-xl text-xs font-bold">WhatsApp</button>
            </div>

            {/* Destination card */}
            {destination && (
              <div className="bg-[#1A1A1A] rounded-2xl px-4 py-3 mb-3 flex items-center gap-2.5">
                <EnvironmentOutlined className="text-lg text-[#FFD600] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#888] font-bold tracking-widest uppercase mb-0.5">Meeting point</p>
                  <p className="text-sm font-black text-[#FFD600] truncate">{destination.w3w ? `///${destination.w3w}` : (destination.label ?? 'Set')}</p>
                </div>
                <button onClick={() => setShowDestSheet(true)} className="px-2.5 py-1.5 bg-white/10 text-white border border-white/15 rounded-lg text-[11px] font-bold shrink-0">Change</button>
              </div>
            )}

            {/* Members section */}
            <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2.5">Members · {otherMembers.length + 1}</p>

            {/* My row */}
            <div className="flex items-center gap-3 py-2.5 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                <UserOutlined className="text-[15px] text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1A1A1A]">{name || 'Me'}</p>
                <p className="text-[11px] text-[#888]">You</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            </div>

            {/* Other members */}
            {otherMembers.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-[13px] text-[#BBB]">Waiting for others to join…</p>
                <p className="text-[11px] text-[#CCC] mt-1">Share the code above</p>
              </div>
            ) : (
              otherMembers.map((m, idx) => {
                const d = position ? dist(position, m) : null;
                const eta = d ? Math.round((d / 5) * 60) : null;
                const destDist = destination && d !== null ? dist(m, destination) : null;
                const destEta  = destDist !== null ? Math.round((destDist! / 5) * 60) : null;
                return (
                  <div key={m.memberId} className="flex items-center gap-3 py-2.5 border-b border-[#F0F0F0]">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: memberColor(idx) }}>
                      <span className="text-sm font-black text-white">{m.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">{m.name}</p>
                      <p className="text-[11px] text-[#888]">
                        {d !== null ? (d < 1 ? `${Math.round(d * 1000)}m away` : `${d.toFixed(1)}km away`) : 'Locating…'}
                      </p>
                    </div>
                    {destination && destEta !== null ? (
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black text-[#1A1A1A]">{destEta}m</p>
                        <p className="text-[10px] text-[#888]">to pin</p>
                      </div>
                    ) : eta !== null ? (
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black text-[#1A1A1A]">{eta < 1 ? '<1m' : `${eta}m`}</p>
                        <p className="text-[10px] text-[#888]">from you</p>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {/* Action buttons */}
            <div className="flex gap-2.5 mt-5 mb-3">
              <button onClick={() => setShowDestSheet(true)} className="flex-1 py-3.5 bg-[#F7F7F7] text-[#1A1A1A] border-[1.5px] border-[#EBEBEB] rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2">
                <EnvironmentOutlined className="text-sm" />
                {destination ? 'Change Pin' : 'Set Meeting Point'}
              </button>
              <button onClick={() => { socketRef.current?.emit('arrived', { code: activeCode, name }); setArrived(true); }} disabled={arrived} className={`flex-1 py-3.5 rounded-2xl text-[13px] font-black ${arrived ? 'bg-[#F0FDF4] text-[#16A34A] border-[1.5px] border-[#86EFAC]' : 'bg-[#1A1A1A] text-white border-none'}`}>
                {arrived ? 'Arrived!' : "I've arrived"}
              </button>
            </div>

            <button onClick={leave} className="w-full py-3.5 bg-[#FFF5F5] text-[#DC2626] border-[1.5px] border-[#FCA5A5] rounded-2xl text-[13px] font-bold">Leave Group</button>
          </div>
        </div>

        {/* Arrival notifications */}
        <div className="absolute top-[100px] left-4 right-4 z-40 pointer-events-none flex flex-col gap-2">
          {arrivals.map((a, i) => (
            <div key={`${a.name}-${a.timestamp}`} className="bg-[#F0FDF4] rounded-2xl px-4 py-2.5 border-[1.5px] border-[#86EFAC] shadow-md flex items-center gap-2.5 animate-slide-in-right">
              <EnvironmentOutlined className="text-lg text-[#16A34A]" />
              <p className="text-[13px] font-bold text-[#15803D]">{a.name} has arrived!</p>
            </div>
          ))}
        </div>

        {/* Destination sheet overlay */}
        {showDestSheet && (
          <div className="absolute inset-0 z-30 bg-black/50 flex items-end pointer-events-auto" onClick={() => setShowDestSheet(false)}>
            <div className="w-full bg-white rounded-t-[28px] px-5 pt-6 pb-12" onClick={e => e.stopPropagation()}>
              <div className="w-9 h-1 rounded-full bg-[#EBEBEB] mx-auto mb-5" />
              <p className="text-base font-black text-[#1A1A1A] mb-4">Set Meeting Point</p>
              <button onClick={pinMyLocation} className="w-full py-3.5 bg-[#FFD600] text-[#1A1A1A] rounded-2xl text-sm font-black mb-3 flex items-center justify-center gap-2">
                <EnvironmentOutlined className="text-[15px]" />
                Pin my current location
              </button>
              <p className="text-xs text-[#888] text-center mb-3">or enter a what3words address</p>
              <div className="flex gap-2">
                <input className="flex-1 bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-xl px-4 py-3.5 text-sm outline-none" placeholder="e.g. filled.count.soap" value={destInput} onChange={e => setDestInput(e.target.value)} />
                <button onClick={submitDestination} disabled={!destInput.trim() || destLoading} className={`px-4.5 py-3.5 rounded-xl text-[13px] font-black flex items-center gap-1.5 ${destInput.trim() ? 'bg-[#1A1A1A] text-white cursor-pointer' : 'bg-[#EBEBEB] text-[#BBB] cursor-not-allowed'}`}>
                  {destLoading ? <LoadingOutlined className="text-sm" /> : 'Set'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SETUP VIEW (Always Mounted) ───────────────────────────────────── */}
      <div className={`absolute inset-0 transition-opacity duration-500 z-10 flex flex-col bg-[#F7F7F7] ${step === 'setup' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white pt-12 px-5 pb-5 border-b border-[#EBEBEB]">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] flex items-center justify-center shrink-0">
              <ArrowLeftOutlined className="text-[15px] text-[#1A1A1A]" />
            </button>
            <div>
              <h1 className="text-[22px] font-black text-[#1A1A1A] leading-tight">Group Location</h1>
              <p className="text-xs text-[#888] mt-0.5">Track everyone in real-time</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 no-scroll">
          <div className="flex bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-[14px] p-1 mb-7">
            {(['create', 'join'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-[11px] text-[13px] font-bold transition-all ${tab === t ? 'bg-[#1A1A1A] text-white' : 'bg-transparent text-[#888]'}`}>
                {t === 'create' ? 'Create Group' : 'Join Group'}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2">Your display name</p>
          <input className="w-full bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-[14px] px-4 py-3.5 text-[15px] outline-none mb-5" placeholder="How others will see you" value={name} onChange={e => setName(e.target.value)} />

          {tab === 'join' && (
            <>
              <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2">Session code</p>
              <input className="w-full text-center text-2xl font-black tracking-[6px] uppercase bg-[#F7F7F7] border-2 border-[#EBEBEB] rounded-2xl p-4 outline-none mb-6" placeholder="KAA-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8} />
            </>
          )}

          {tab === 'create' && (
            <div className="bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-2xl px-4 py-3.5 mb-6">
              <p className="text-[13px] font-bold text-[#1A1A1A] mb-1">How it works</p>
              <p className="text-xs text-[#888] leading-relaxed">Start a group session and share the code with your friends. Everyone joins and sees each other's live location on the map. Set a meeting point to show ETAs.</p>
            </div>
          )}

          <button onClick={tab === 'create' ? startGroup : joinGroup} disabled={!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)} className={`w-full py-4 rounded-2xl text-[15px] font-black flex items-center justify-center gap-2.5 ${(!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)) ? 'bg-[#EBEBEB] text-[#BBB]' : 'bg-[#1A1A1A] text-white'}`}>
            {starting ? <LoadingOutlined className="text-base" /> : <TeamOutlined className="text-[15px]" />}
            {starting ? 'Starting…' : !position ? 'Getting location…' : tab === 'create' ? 'Start Group Session' : 'Join Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
