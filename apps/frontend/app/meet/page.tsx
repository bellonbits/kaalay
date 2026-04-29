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

    s.on('member-list',    onMemberList);
    s.on('member-joined',  onMemberJoined);
    s.on('member-left',    onMemberLeft);
    s.on('member-location', onMemberLocation);
    s.on('destination',    onDestination);

    return () => {
      joinedRef.current = false;
      s.emit('leave-group', { code: activeCode, memberId: myId.current });
      s.off('member-list',    onMemberList);
      s.off('member-joined',  onMemberJoined);
      s.off('member-left',    onMemberLeft);
      s.off('member-location', onMemberLocation);
      s.off('destination',    onDestination);
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

  // ── LIVE VIEW ────────────────────────────────────────────────────────────
  if (step === 'live') return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#F7F7F7' }}>
      {/* Map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapBase center={center} zoom={14} markers={markers}
          routeTo={destination ?? undefined} className="w-full h-full" />
      </div>

      {/* Back button */}
      <button onClick={leave} style={{
        position: 'absolute', top: 48, left: 16, zIndex: 20,
        width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
      }}>
        <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
      </button>

      {/* Top pill: code + member count */}
      <div style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 20, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          borderRadius: 50, padding: '6px 16px', border: '1px solid #EBEBEB',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <TeamOutlined style={{ fontSize: 12, color: '#1A1A1A' }} />
          <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '2px', color: '#1A1A1A' }}>{activeCode}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{otherMembers.length + 1} here</span>
        </div>
      </div>

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        height: '75%', background: '#FFFFFF',
        borderRadius: '28px 28px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.10)',
        transform: `translateY(${sheetTranslate})`,
        transition: 'transform 0.35s cubic-bezier(.22,.68,0,1.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#EBEBEB' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 40px' }}>
          {/* Invite row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#F7F7F7', border: '1.5px solid #EBEBEB', borderRadius: 12, padding: '10px 14px' }}>
              <p style={{ fontSize: 10, color: '#888', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Session code</p>
              <p style={{ fontSize: 18, fontWeight: 900, letterSpacing: '4px', color: '#1A1A1A' }}>{activeCode}</p>
            </div>
            <button onClick={copyCode} style={{
              padding: '10px 14px', background: copied ? '#F0FDF4' : '#F7F7F7',
              color: copied ? '#16A34A' : '#1A1A1A',
              border: `1.5px solid ${copied ? '#86EFAC' : '#EBEBEB'}`,
              borderRadius: 12, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Inter, sans-serif',
            }}>
              {copied ? <CheckOutlined style={{ fontSize: 12 }} /> : <CopyOutlined style={{ fontSize: 12 }} />}
              {copied ? 'Copied!' : 'Invite'}
            </button>
            <button onClick={shareWhatsApp} style={{
              padding: '10px 14px', background: '#25D366', color: '#FFFFFF',
              border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              WhatsApp
            </button>
          </div>

          {/* Destination card */}
          {destination && (
            <div style={{ background: '#1A1A1A', borderRadius: 16, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <EnvironmentOutlined style={{ fontSize: 18, color: '#FFD600', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, color: '#888', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Meeting point</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: '#FFD600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {destination.w3w ? `///${destination.w3w}` : (destination.label ?? 'Set')}
                </p>
              </div>
              <button onClick={() => setShowDestSheet(true)} style={{
                padding: '6px 10px', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
              }}>
                Change
              </button>
            </div>
          )}

          {/* Members section */}
          <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
            Members · {otherMembers.length + 1}
          </p>

          {/* My row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#1A1A1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <UserOutlined style={{ fontSize: 15, color: '#FFFFFF' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{name || 'Me'}</p>
              <p style={{ fontSize: 11, color: '#888' }}>You</p>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
          </div>

          {/* Other members */}
          {otherMembers.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#BBBBBB' }}>Waiting for others to join…</p>
              <p style={{ fontSize: 11, color: '#CCCCCC', marginTop: 4 }}>Share the code above</p>
            </div>
          ) : (
            otherMembers.map((m, idx) => {
              const d = position ? dist(position, m) : null;
              const eta = d ? Math.round((d / 5) * 60) : null;
              const destDist = destination && d !== null ? dist(m, destination) : null;
              const destEta  = destDist !== null ? Math.round((destDist! / 5) * 60) : null;
              return (
                <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: memberColor(idx),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#FFFFFF' }}>{m.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                    <p style={{ fontSize: 11, color: '#888' }}>
                      {d !== null ? (d < 1 ? `${Math.round(d * 1000)}m away` : `${d.toFixed(1)}km away`) : 'Locating…'}
                    </p>
                  </div>
                  {destination && destEta !== null ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>{destEta}m</p>
                      <p style={{ fontSize: 10, color: '#888' }}>to pin</p>
                    </div>
                  ) : eta !== null ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>{eta < 1 ? '<1m' : `${eta}m`}</p>
                      <p style={{ fontSize: 10, color: '#888' }}>from you</p>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowDestSheet(true)} style={{
              flex: 1, padding: '14px', background: '#F7F7F7', color: '#1A1A1A',
              border: '1.5px solid #EBEBEB', borderRadius: 16, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              <EnvironmentOutlined style={{ fontSize: 14 }} />
              {destination ? 'Change Pin' : 'Set Meeting Point'}
            </button>
            <button onClick={leave} style={{
              flex: 1, padding: '14px', background: '#FFF5F5', color: '#DC2626',
              border: '1.5px solid #FCA5A5', borderRadius: 16, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Destination sheet overlay */}
      {showDestSheet && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowDestSheet(false)}>
          <div style={{
            width: '100%', background: '#FFFFFF',
            borderRadius: '28px 28px 0 0', padding: '24px 20px 48px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#EBEBEB', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', marginBottom: 16 }}>Set Meeting Point</p>

            <button onClick={pinMyLocation} style={{
              width: '100%', padding: '14px', background: '#FFD600', color: '#1A1A1A',
              border: 'none', borderRadius: 16, fontSize: 14, fontWeight: 800,
              cursor: 'pointer', marginBottom: 12, fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <EnvironmentOutlined style={{ fontSize: 15 }} />
              Pin my current location
            </button>

            <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 }}>or enter a what3words address</p>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{
                  flex: 1, background: '#F7F7F7', border: '1.5px solid #EBEBEB',
                  borderRadius: 14, padding: '14px 16px', fontSize: 14, color: '#1A1A1A',
                  outline: 'none', fontFamily: 'Inter, sans-serif',
                }}
                placeholder="e.g. filled.count.soap"
                value={destInput}
                onChange={e => setDestInput(e.target.value)}
              />
              <button onClick={submitDestination} disabled={!destInput.trim() || destLoading} style={{
                padding: '14px 18px', background: destInput.trim() ? '#1A1A1A' : '#EBEBEB',
                color: destInput.trim() ? '#FFFFFF' : '#BBBBBB',
                border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 800,
                cursor: destInput.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {destLoading ? <LoadingOutlined style={{ fontSize: 14 }} /> : 'Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── SETUP VIEW ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F7F7F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 20px 20px', borderBottom: '1px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F7F7F7',
            border: '1.5px solid #EBEBEB', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 15, color: '#1A1A1A' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', lineHeight: 1.1 }}>Group Location</h1>
            <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Track everyone in real-time</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 40px' }}>
        {/* Tab pills */}
        <div style={{ display: 'flex', background: '#F7F7F7', borderRadius: 14, padding: 4, marginBottom: 28, border: '1.5px solid #EBEBEB' }}>
          {(['create', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', borderRadius: 11,
              background: tab === t ? '#1A1A1A' : 'transparent',
              color: tab === t ? '#FFFFFF' : '#888',
              border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            }}>
              {t === 'create' ? 'Create Group' : 'Join Group'}
            </button>
          ))}
        </div>

        {/* Name field — shared across both tabs */}
        <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Your display name</p>
        <input
          style={{
            width: '100%', background: '#F7F7F7', border: '1.5px solid #EBEBEB',
            borderRadius: 14, padding: '14px 16px', fontSize: 15, color: '#1A1A1A',
            outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: 20,
          }}
          placeholder="How others will see you"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {tab === 'join' && (
          <>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Session code</p>
            <input
              style={{
                width: '100%', textAlign: 'center', fontSize: 24, fontWeight: 900,
                letterSpacing: '6px', color: '#1A1A1A', background: '#F7F7F7',
                border: '2px solid #EBEBEB', borderRadius: 16, padding: '16px',
                outline: 'none', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', marginBottom: 24,
              }}
              placeholder="KAA-XXXX"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </>
        )}

        {tab === 'create' && (
          <div style={{ background: '#F7F7F7', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #EBEBEB', marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>How it works</p>
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
              Start a group session and share the code with your friends. Everyone joins and sees each other's live location on the map. Set a meeting point to show ETAs.
            </p>
          </div>
        )}

        <button
          onClick={tab === 'create' ? startGroup : joinGroup}
          disabled={!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)}
          style={{
            width: '100%', padding: '16px',
            background: (!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)) ? '#EBEBEB' : '#1A1A1A',
            color: (!name.trim() || !position || starting || (tab === 'join' && joinCode.length < 6)) ? '#BBBBBB' : '#FFFFFF',
            border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {starting ? <LoadingOutlined style={{ fontSize: 16 }} /> : <TeamOutlined style={{ fontSize: 15 }} />}
          {starting ? 'Starting…' : !position ? 'Getting location…' : tab === 'create' ? 'Start Group Session' : 'Join Session'}
        </button>
      </div>
    </div>
  );
}
