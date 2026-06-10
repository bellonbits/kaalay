'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, TeamOutlined, CopyOutlined, CheckOutlined,
  EnvironmentOutlined, UserOutlined, LoadingOutlined, AimOutlined,
  CompassOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSocket } from '../../hooks/useSocket';
import { onReconnect } from '../../lib/socket';
import { shareInvite, copyText } from '../../lib/share';
import { createSession, convertTo3wa } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';

const MapBase = dynamic(() => import('../../components/MapBase'), { ssr: false });

interface GroupMember {
  memberId: string; name: string;
  lat: number; lng: number;
  accuracy?: number; heading?: number;
  lastSeen: number; isHost?: boolean;
}

interface HostLocation { lat: number; lng: number; accuracy?: number; heading?: number; w3w?: string }

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
  const router = useRouter();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();

  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [membersList, setMembersList] = useState<GroupMember[]>([]);

  // Host state — who is the destination
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostLocation, setHostLocation] = useState<HostLocation | null>(null);
  const [hostName, setHostName] = useState<string>('');
  const [iAmHost, setIAmHost] = useState(false);

  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sheetH, setSheetH] = useState<'peek' | 'half' | 'full'>('half');
  const [arrivals, setArrivals] = useState<{ name: string; timestamp: number }[]>([]);
  const [arrived, setArrived] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [joinAlerts, setJoinAlerts] = useState<{ name: string; timestamp: number }[]>([]);

  const membersRef = useRef(new Map<string, GroupMember>());
  const myId = useRef('');
  const joinedRef = useRef(false);
  const broadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostBroadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest values readable from socket reconnect callbacks (which capture stale closures)
  const positionRef = useRef(position);
  const nameRef = useRef(name);
  positionRef.current = position;
  nameRef.current = name;

  const sync = useCallback(() => {
    setMembersList(Array.from(membersRef.current.values()));
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (u) {
      const parsed = JSON.parse(u);
      setName(parsed.fullName ?? '');
      myId.current = parsed.id ?? Math.random().toString(36).slice(2);
    } else {
      myId.current = Math.random().toString(36).slice(2);
    }
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setJoinCode(c.toUpperCase()); setTab('join'); }
  }, []);

  // Hide BottomNav when live meetup is active
  useEffect(() => {
    const isLive = step === 'live';
    window.dispatchEvent(new CustomEvent('hide-bottom-nav', { detail: isLive }));
    return () => {
      window.dispatchEvent(new CustomEvent('hide-bottom-nav', { detail: false }));
    };
  }, [step]);

  // ── SOCKET LISTENERS ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'live' || !activeCode) return;
    const s = socketRef.current;
    if (!s) return;

    const onMemberList = (list: GroupMember[]) => {
      membersRef.current.clear();
      const filtered = list.filter(m => m.memberId !== myId.current);
      // Stamp client-side lastSeen so the stale sweep measures against our clock
      filtered.forEach(m => membersRef.current.set(m.memberId, { ...m, lastSeen: Date.now() }));
      
      // Detect existing host from list
      const host = list.find(m => m.isHost);
      if (host) {
        setHostId(host.memberId);
        setHostName(host.name);
        setHostLocation({ lat: host.lat, lng: host.lng, accuracy: host.accuracy });
        if (host.memberId === myId.current) {
          setIAmHost(true);
          if (filtered.length > 0) {
            setSelectedMemberId(prev => prev || filtered[0].memberId);
          }
        }
      }
      sync();
    };

    const onMemberJoined = (m: GroupMember) => {
      if (m.memberId === myId.current) return;
      membersRef.current.set(m.memberId, { ...m, lastSeen: Date.now() });
      
      const timestamp = Date.now();
      setJoinAlerts(prev => [{ name: m.name, timestamp }, ...prev].slice(0, 3));
      setTimeout(() => {
        setJoinAlerts(prev => prev.filter(j => j.timestamp !== timestamp));
      }, 4000);

      if (iAmHost || hostId === myId.current) {
        setSelectedMemberId(m.memberId);
      }
      
      sync();
    };

    const onMemberLeft = ({ memberId }: { memberId: string }) => {
      membersRef.current.delete(memberId);
      if (memberId === selectedMemberId) {
        const remaining = Array.from(membersRef.current.values());
        setSelectedMemberId(remaining.length > 0 ? remaining[0].memberId : null);
      }
      // If host left, clear host state
      if (memberId === hostId) {
        setHostId(null);
        setHostLocation(null);
        setHostName('');
      }
      sync();
    };

    const onMemberLocation = (u: { memberId: string; lat: number; lng: number; accuracy?: number; heading?: number }) => {
      const existing = membersRef.current.get(u.memberId);
      if (existing) {
        membersRef.current.set(u.memberId, { ...existing, ...u, lastSeen: Date.now() });
        sync();
      }
    };

    // ← KEY: real-time host position updates
    const onHostMoved = async (d: { lat: number; lng: number; accuracy?: number; heading?: number }) => {
      // Resolve w3w in background — don't block the position update
      setHostLocation(prev => ({ ...prev, ...d }));
      convertTo3wa(d.lat, d.lng)
        .then(r => setHostLocation(prev => prev ? { ...prev, w3w: r.what3words } : prev))
        .catch(() => {});
    };

    const onHostChanged = ({ hostId: newHostId, name: newHostName }: { hostId: string; name: string }) => {
      setHostId(newHostId);
      setHostName(newHostName);
      if (newHostId === myId.current) {
        setIAmHost(true);
        const currentMembers = Array.from(membersRef.current.values());
        if (currentMembers.length > 0) {
          setSelectedMemberId(currentMembers[0].memberId);
        }
      }
    };

    const onMemberArrived = (d: { name: string; timestamp: number }) => {
      setArrivals(prev => [d, ...prev].slice(0, 3));
      setTimeout(() => {
        setArrivals(prev => prev.filter(a => a.timestamp !== d.timestamp));
      }, 4000);
    };

    s.on('member-list', onMemberList);
    s.on('member-joined', onMemberJoined);
    s.on('member-left', onMemberLeft);
    s.on('member-location', onMemberLocation);
    s.on('host-moved', onHostMoved);
    s.on('host-changed', onHostChanged);
    s.on('member-arrived', onMemberArrived);

    return () => {
      joinedRef.current = false;
      s.emit('leave-group', { code: activeCode, memberId: myId.current });
      s.off('member-list', onMemberList);
      s.off('member-joined', onMemberJoined);
      s.off('member-left', onMemberLeft);
      s.off('member-location', onMemberLocation);
      s.off('host-moved', onHostMoved);
      s.off('host-changed', onHostChanged);
      s.off('member-arrived', onMemberArrived);
    };
  }, [step, activeCode, hostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join once position ready, and re-join automatically on every (re)connect.
  // Mobile sockets drop on backgrounding / network switches; without the
  // re-emit the server forgets our room and live updates silently stop.
  useEffect(() => {
    if (step !== 'live' || !activeCode || !position) return;

    const emitJoin = () => {
      const p = positionRef.current;
      if (!p) return;
      socketRef.current?.emit('join-group', {
        code: activeCode, memberId: myId.current, name: nameRef.current,
        lat: p.lat, lng: p.lng, accuracy: p.accuracy, heading: p.heading,
      });
    };

    if (!joinedRef.current) {
      joinedRef.current = true;
      emitJoin();
    }
    // Re-join on each reconnect (fires immediately if already connected too,
    // which is a harmless idempotent re-join on the server).
    const off = onReconnect(emitJoin);
    return off;
  }, [step, activeCode, position]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prune members who stopped broadcasting (left the app, lost signal). Their
  // last update is tracked in lastSeen; >35s without one drops them so the
  // roster and "online" dots reflect reality.
  useEffect(() => {
    if (step !== 'live') return;
    const sweep = setInterval(() => {
      const now = Date.now();
      let changed = false;
      membersRef.current.forEach((m, id) => {
        if (now - (m.lastSeen ?? 0) > 35000) {
          membersRef.current.delete(id);
          changed = true;
          if (id === selectedMemberId) {
            const rest = Array.from(membersRef.current.values());
            setSelectedMemberId(rest.length ? rest[0].memberId : null);
          }
          if (id === hostId) { setHostId(null); setHostLocation(null); setHostName(''); }
        }
      });
      // Always re-sync so "online/away" freshness dots update even when a
      // member has simply gone quiet (no changed membership).
      sync();
    }, 5000);
    return () => clearInterval(sweep);
  }, [step, selectedMemberId, hostId, sync]);

  // ── REGULAR member location broadcast (everyone, 3s) ─────────────────────
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

  // ── HOST location broadcast (1s — faster for live tracking) ──────────────
  useEffect(() => {
    if (!iAmHost || !activeCode || !position) return;
    hostBroadRef.current = setInterval(() => {
      socketRef.current?.emit('host-location', {
        code: activeCode, memberId: myId.current,
        lat: position.lat, lng: position.lng,
        accuracy: position.accuracy, heading: position.heading,
      });
    }, 1000); // 1s refresh for host — smooth tracking for incoming members
    return () => { if (hostBroadRef.current) clearInterval(hostBroadRef.current); };
  }, [iAmHost, activeCode, position]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  const becomeHost = () => {
    setIAmHost(true);
    setHostId(myId.current);
    setHostName(name);
    if (position) {
      setHostLocation({ lat: position.lat, lng: position.lng, accuracy: position.accuracy });
    }
    const currentMembers = Array.from(membersRef.current.values());
    if (currentMembers.length > 0) {
      setSelectedMemberId(currentMembers[0].memberId);
    }
    socketRef.current?.emit('set-host', {
      code: activeCode, memberId: myId.current, name,
    });
  };

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
    if (hostBroadRef.current) clearInterval(hostBroadRef.current);
    router.push('/home');
  };

  const inviteUrl = () => `${window.location.origin}/meet?code=${activeCode}`;

  // Native share sheet (WhatsApp, SMS, AirDrop…) with clipboard fallback.
  const invite = async () => {
    const outcome = await shareInvite({
      title: 'Join my Kaalay meetup',
      text: `Join my live location on Kaalay — code ${activeCode}.`,
      url: inviteUrl(),
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyCode = async () => {
    if (await copyText(inviteUrl())) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareWhatsApp = () => {
    const txt = `Join my location on Kaalay!\n\nCode: ${activeCode}\nLink: ${inviteUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  // ── DERIVED STATE ─────────────────────────────────────────────────────────
  const sheetTranslate = sheetH === 'peek' ? 'calc(100% - 120px)' : sheetH === 'half' ? 'calc(100% - 460px)' : '0px';

  // Selected member derived distance & ETA for host
  const selectedMember = selectedMemberId ? membersList.find(m => m.memberId === selectedMemberId) : null;
  const distToSelected = position && selectedMember
    ? dist(position, selectedMember)
    : null;
  const etaToSelected = distToSelected !== null
    ? Math.round((distToSelected / 5) * 60)
    : null;

  // Distance from me to the host
  const distToHost = position && hostLocation
    ? dist(position, hostLocation)
    : null;

  const etaToHost = distToHost !== null
    ? Math.round((distToHost / 5) * 60) // walking ETA in minutes at 5km/h
    : null;

  // Map markers
  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, accuracy: position.accuracy, heading: position.heading }] : []),
    ...membersList.map((m, idx) => ({
      lat: m.lat, lng: m.lng,
      type: (m.memberId === hostId ? 'request' : 'tracked') as MarkerData['type'],
      label: m.name,
    })),
    // Host pin shown separately if host is not in membersList (e.g. host is "me" on another device)
  ];

  const center = position ?? { lat: -1.29, lng: 36.82 };

  // Route details:
  // 1. Non-host: route to host
  // 2. Host: route to selected member
  const routeTo = !iAmHost && hostLocation
    ? { lat: hostLocation.lat, lng: hostLocation.lng }
    : iAmHost && selectedMember
    ? { lat: selectedMember.lat, lng: selectedMember.lng }
    : undefined;

  const routeFrom = position ?? undefined;

  return (
    <div className="h-full relative bg-[#F7F7F7] overflow-hidden font-outfit">

      {/* ── LIVE VIEW ──────────────────────────────────────────────────────── */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${step === 'live' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>

        {/* Map — routes non-hosts to host in real time */}
        <div className="absolute inset-0 z-0">
          <MapBase
            center={center}
            zoom={15}
            markers={markers}
            routeFrom={routeFrom}
            routeTo={routeTo}
            travelMode="WALKING"
            zoomState={routeTo ? 'navigation' : 'tracking'}
            followMode={!iAmHost && !!routeTo}
            className="w-full h-full"
          />
        </div>

        {/* Back */}
        <button onClick={leave} className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md">
          <ArrowLeftOutlined className="text-[15px] text-[#1A1A1A]" />
        </button>

        {/* Session pill */}
        <div className="absolute top-12 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md rounded-full px-4 py-1.5 border border-[#EBEBEB] shadow-sm flex items-center gap-2.5">
            <TeamOutlined className="text-xs text-[#1A1A1A]" />
            <span className="text-xs font-black tracking-widest text-[#1A1A1A]">{activeCode}</span>
            <span className="text-[11px] text-[#888]">{membersList.length + 1} here</span>
          </div>
        </div>

        {/* Live ETA banner — shown to non-hosts when host exists */}
        {!iAmHost && hostLocation && distToHost !== null && (
          <div className="absolute top-[88px] left-4 right-4 z-20 pointer-events-none">
            <div className="bg-[#000080] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
              <CompassOutlined className="text-xl text-white shrink-0 animate-spin-slow" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Heading to</p>
                <p className="text-sm font-black text-white truncate">
                  {hostName}
                  {hostLocation.w3w && (
                    <span className="text-white/80 ml-1.5 text-[11px]">/// {hostLocation.w3w}</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-black text-white">{etaToHost !== null ? `${etaToHost}m` : '—'}</p>
                <p className="text-[10px] text-white/70">
                  {distToHost < 1 ? `${Math.round(distToHost * 1000)}m away` : `${distToHost.toFixed(1)}km`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live ETA banner for Host tracking a member */}
        {iAmHost && selectedMember && distToSelected !== null && (
          <div className="absolute top-[88px] left-4 right-4 z-20 pointer-events-none">
            <div className="bg-[#000080] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
              <CompassOutlined className="text-xl text-white shrink-0 animate-spin-slow" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Tracking member</p>
                <p className="text-sm font-black text-white truncate">{selectedMember.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-black text-white">{etaToSelected !== null ? `${etaToSelected}m` : '—'}</p>
                <p className="text-[10px] text-white/70">
                  {distToSelected < 1 ? `${Math.round(distToSelected * 1000)}m away` : `${distToSelected.toFixed(1)}km`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Host badge */}
        {iAmHost && !selectedMember && (
          <div className="absolute top-[88px] left-4 right-4 z-20 pointer-events-none">
            <div className="bg-[#000080] rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-md">
              <AimOutlined className="text-base text-white" />
              <p className="text-[13px] font-black text-white">
                You are the meeting point · {membersList.length} heading to you
              </p>
            </div>
          </div>
        )}

        {/* Bottom sheet */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 h-[80%] bg-white rounded-t-[28px] shadow-sheet flex flex-col transition-transform duration-300 ease-out"
          style={{ transform: `translateY(${sheetTranslate})` }}
        >
          <div className="flex justify-center py-3 cursor-pointer shrink-0"
            onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}>
            <div className="w-9 h-1 rounded-full bg-[#EBEBEB]" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 no-scroll" style={{ paddingBottom: 'calc(2.5rem + var(--safe-bottom))' }}>
            {/* Invite row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] text-[#888] font-bold tracking-widest uppercase mb-0.5">Session code</p>
                <p className="text-lg font-black tracking-widest text-[#000080]">{activeCode}</p>
              </div>
              <button onClick={invite} className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${copied ? 'bg-[#F0FDF4] text-[#16A34A] border-[1.5px] border-[#86EFAC]' : 'bg-[#F7F7F7] text-[#000080] border-[1.5px] border-[#EBEBEB]'}`}>
                {copied ? <CheckOutlined /> : <ShareAltOutlined />}
                {copied ? 'Copied!' : 'Invite'}
              </button>
              <button onClick={shareWhatsApp} className="px-3.5 py-2.5 bg-[#25D366] text-white border-none rounded-xl text-xs font-bold">WhatsApp</button>
            </div>

            {/* Host card */}
            {hostId ? (
              <div className="bg-[#000080] rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                  <AimOutlined className="text-[#000080] text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[10px] text-white/60 font-bold tracking-widest uppercase">Meeting point</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" title="Host Online" />
                  </div>
                  <p className="text-sm font-black text-white truncate">{hostName}</p>
                  {hostLocation?.w3w && (
                    <p className="text-[11px] text-white/80">/// {hostLocation.w3w}</p>
                  )}
                </div>
                {iAmHost && (
                  <div className="px-2.5 py-1 bg-white rounded-lg shrink-0">
                    <span className="text-[10px] font-black text-[#000080]">YOU</span>
                  </div>
                )}
              </div>
            ) : (
              /* Nobody is host yet — prompt someone to become it */
              <button onClick={becomeHost} className="w-full py-3.5 bg-[#000080] text-white rounded-2xl text-[13px] font-black flex items-center justify-center gap-2 mb-4 hover:bg-[#000066] transition-colors">
                <AimOutlined className="text-base" />
                I'm the meeting point — come to me
              </button>
            )}

            {/* Members */}
            <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2.5">
              Members · {membersList.length + 1}
            </p>

            {/* Me */}
            <div className="flex items-center gap-3 py-2.5 border-b border-[#F0F0F0]">
              <div className="w-9 h-9 rounded-full bg-[#000080] flex items-center justify-center shrink-0">
                <UserOutlined className="text-[15px] text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#000080]">{name || 'Me'}</p>
                <p className="text-[11px] text-[#888]">You {iAmHost && '· 📍 Meeting point'}</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            </div>

            {/* Others */}
            {membersList.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-[13px] text-[#BBB]">Waiting for others to join…</p>
                <p className="text-[11px] text-[#CCC] mt-1">Share the code above</p>
              </div>
            ) : (
              membersList.map((m, idx) => {
                const dToMe = position ? dist(position, m) : null;
                const dToHost = hostLocation ? dist(m, hostLocation) : null;
                const etaMin = dToHost !== null ? Math.round((dToHost! / 5) * 60) : null;
                const isSelected = selectedMemberId === m.memberId;
                return (
                  <div 
                    key={m.memberId} 
                    onClick={() => {
                      if (iAmHost) {
                        setSelectedMemberId(m.memberId);
                      }
                    }}
                    className={`flex items-center gap-3 py-2.5 border-b border-[#F0F0F0] ${iAmHost ? 'cursor-pointer hover:bg-gray-50 px-2 rounded-xl transition-colors' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
                      style={{ background: m.memberId === hostId ? '#000080' : memberColor(idx) }}>
                      <span className="text-sm font-black text-white">{m.name.charAt(0).toUpperCase()}</span>
                      {m.memberId === hostId && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#000080] rounded-full flex items-center justify-center">
                          <AimOutlined className="text-[7px] text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[#000080] truncate">{m.name}</p>
                        {(() => {
                          const fresh = Date.now() - (m.lastSeen ?? 0) < 12000;
                          return (
                            <div
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fresh ? 'bg-[#22C55E] animate-pulse' : 'bg-[#F59E0B]'}`}
                              title={fresh ? 'Live' : 'Away'}
                            />
                          );
                        })()}
                        {iAmHost && isSelected && (
                          <span className="px-1.5 py-0.5 bg-[#000080]/10 text-[#000080] text-[9px] font-black rounded uppercase tracking-wider">
                            Tracking
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#888]">
                        {dToMe !== null
                          ? dToMe < 1 ? `${Math.round(dToMe * 1000)}m from you` : `${dToMe.toFixed(1)}km from you`
                          : 'Locating…'}
                      </p>
                    </div>
                    {/* Show ETA to host for each member */}
                    {etaMin !== null && m.memberId !== hostId ? (
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black text-[#000080]">{etaMin < 1 ? '<1m' : `${etaMin}m`}</p>
                        <p className="text-[10px] text-[#888]">to meet</p>
                      </div>
                    ) : m.memberId === hostId ? (
                      <div className="px-2 py-1 bg-[#000080]/10 rounded-lg shrink-0">
                        <p className="text-[10px] font-black text-[#000080]">📍 Here</p>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {/* Arrived + Leave */}
            <div className="flex gap-2.5 mt-5 mb-3">
              {!iAmHost && (
                <button
                  onClick={() => { socketRef.current?.emit('arrived', { code: activeCode, name }); setArrived(true); }}
                  disabled={arrived}
                  className={`flex-1 py-3.5 rounded-2xl text-[13px] font-black ${arrived ? 'bg-[#F0FDF4] text-[#16A34A] border-[1.5px] border-[#86EFAC]' : 'bg-[#000080] text-white border-none hover:bg-[#000066] transition-colors'}`}
                >
                  {arrived ? '✓ Arrived!' : "I've arrived"}
                </button>
              )}
              {!hostId && !iAmHost && (
                <button onClick={becomeHost} className="flex-1 py-3.5 bg-white text-[#000080] border-[1.5px] border-[#000080] rounded-2xl text-[13px] font-black hover:bg-gray-50 transition-colors">
                  I'm the pin
                </button>
              )}
            </div>
            <button onClick={leave} className="w-full py-3.5 bg-[#FFF5F5] text-[#DC2626] border-[1.5px] border-[#FCA5A5] rounded-2xl text-[13px] font-bold">
              Leave Group
            </button>
          </div>

          {/* Solid cover behind BottomNav */}
          <div className="h-28 bg-white shrink-0" />
        </div>

        {/* Arrival + Join toasts */}
        <div className="absolute top-[100px] left-4 right-4 z-40 pointer-events-none flex flex-col gap-2">
          {arrivals.map((a) => (
            <div key={`${a.name}-${a.timestamp}`} className="bg-[#F0FDF4] rounded-2xl px-4 py-2.5 border-[1.5px] border-[#86EFAC] shadow-md flex items-center gap-2.5">
              <EnvironmentOutlined className="text-lg text-[#16A34A]" />
              <p className="text-[13px] font-bold text-[#15803D]">{a.name} has arrived!</p>
            </div>
          ))}
          {joinAlerts.map((j) => (
            <div key={`${j.name}-${j.timestamp}`} className="bg-sky-50 rounded-2xl px-4 py-2.5 border-[1.5px] border-sky-200 shadow-md flex items-center gap-2.5">
              <UserOutlined className="text-lg text-sky-500" />
              <p className="text-[13px] font-bold text-sky-800">{j.name} has joined the session!</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SETUP VIEW (Always Mounted) ───────────────────────────────────── */}
      <div className={`absolute inset-0 transition-opacity duration-500 z-10 flex flex-col bg-[#F7F7F7] ${step === 'setup' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white pt-12 px-5 pb-5 border-b border-[#EBEBEB]">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] flex items-center justify-center shrink-0">
              <ArrowLeftOutlined className="text-[15px] text-[#000080]" />
            </button>
            <div>
              <h1 className="text-[22px] font-black text-[#000080] leading-tight">Group Location</h1>
              <p className="text-xs text-[#888] mt-0.5">Track everyone in real-time</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 no-scroll">
          <div className="flex bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-[14px] p-1 mb-7">
            {(['create', 'join'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-[11px] text-[13px] font-bold transition-all ${tab === t ? 'bg-[#000080] text-white' : 'bg-transparent text-[#888]'}`}>
                {t === 'create' ? 'Create Group' : 'Join Group'}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2">Your display name</p>
          <input className="w-full bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-[14px] px-4 py-3.5 text-[15px] outline-none mb-5 focus:border-[#000080] transition-colors" placeholder="How others will see you" value={name} onChange={e => setName(e.target.value)} />

          {tab === 'join' && (
            <>
              <p className="text-[11px] font-bold text-[#888] tracking-widest uppercase mb-2">Session code</p>
              <input className="w-full text-center text-2xl font-black tracking-[6px] uppercase bg-[#F7F7F7] border-2 border-[#EBEBEB] rounded-2xl p-4 outline-none mb-6 focus:border-[#000080] text-[#000080] transition-colors" placeholder="KAA-XXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8} />
            </>
          )}

          {tab === 'create' && (
            <div className="bg-[#F7F7F7] border-[1.5px] border-[#EBEBEB] rounded-2xl px-4 py-3.5 mb-6">
              <p className="text-[13px] font-bold text-[#000080] mb-1">How it works</p>
              <p className="text-xs text-[#888] leading-relaxed">Start a group session and share the code with your friends. Everyone joins and sees each other's live location on the map. Set a meeting point to show ETAs.</p>
            </div>
          )}

          <button onClick={tab === 'create' ? startGroup : joinGroup} disabled={!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)} className={`w-full py-4 rounded-2xl text-[15px] font-black flex items-center justify-center gap-2.5 ${(!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)) ? 'bg-[#EBEBEB] text-[#BBB]' : 'bg-[#000080] text-white hover:bg-[#000066] transition-colors'}`}>
            {starting ? <LoadingOutlined className="text-base" /> : <TeamOutlined className="text-[15px]" />}
            {starting ? 'Starting…' : !position ? 'Getting location…' : tab === 'create' ? 'Start Group Session' : 'Join Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
