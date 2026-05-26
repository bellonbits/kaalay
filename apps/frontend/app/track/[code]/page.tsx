'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeftOutlined, AlertOutlined, CarOutlined, TeamOutlined,
  EnvironmentOutlined, CheckCircleFilled, CompassOutlined, GlobalOutlined, ShareAltOutlined,
  StarOutlined, StarFilled, PhoneOutlined, MessageOutlined, SafetyOutlined, 
  ClockCircleOutlined, DollarOutlined, LoadingOutlined, RadarChartOutlined,
  ArrowRightOutlined, RedoOutlined
} from '@ant-design/icons';
import { useGeolocation } from '../../../hooks/useGeolocation';
import { useSessionSocket } from '../../../hooks/useSocket';
import { getSessionByCode, convertTo3wa, signalArriving, signalArrived, startRide, completeRide, submitRating } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import type { MarkerData, MapHandle } from '../../../components/MapBase';
import LowDataView from '../../../components/LowDataView';

const MapBase = dynamic(() => import('../../../components/MapBase').then((mod) => {
  const Component = mod.default;
  return function MapBaseWrapper({ forwardedRef, ...props }: any) {
    return <Component ref={forwardedRef} {...props} />;
  };
}), { ssr: false });

interface LivePos { lat: number; lng: number; accuracy?: number; timestamp: number }
interface Session { shareCode: string; requestType: string; message?: string; status: string; user?: { fullName: string }; fare?: number; driverName?: string; vehicleModel?: string; licensePlate?: string; }

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat  * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const TYPE_META: Record<string, { Icon: React.ComponentType<any>; bg: string; color: string; label: string }> = {
  lost:    { Icon: AlertOutlined,       bg: '#FFF5F5', color: '#E03131', label: 'Lost' },
  pickup:  { Icon: CarOutlined,         bg: '#F3F0FF', color: '#7048E8', label: 'Pickup' },
  meetup:  { Icon: TeamOutlined,        bg: '#EBFBEE', color: '#2B8A3E', label: 'Meetup' },
  general: { Icon: EnvironmentOutlined, bg: '#F8F9FA', color: '#495057', label: 'Live' },
};

export default function TrackPage() {
  const params = useParams();
  const code = (params?.code as string) ?? '';
  if (code === 'enter') return <EnterCode />;
  return <LiveTracker code={code} />;
}

function EnterCode() {
  const router = useRouter();
  const [code, setCode] = useState('');
  return (
    <div className="min-h-full flex flex-col bg-white overflow-x-hidden font-outfit">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-400/5 rounded-full blur-[80px]" />
      
      <div className="pt-16 px-6 pb-8 flex items-center gap-4 z-10 animate-fade-in">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 glass rounded-2xl flex items-center justify-center shadow-premium active:scale-90 transition-transform"
        >
          <ArrowLeftOutlined className="text-lg text-black" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">Precision Track</h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Enter live share code</p>
        </div>
      </div>

      <div className="px-6 flex-1 flex flex-col items-center justify-center z-10 animate-slide-up-spring pb-24">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="w-20 h-20 bg-black rounded-[28px] mx-auto flex items-center justify-center shadow-premium mb-4">
            <RadarChartOutlined className="text-3xl text-white" />
          </div>
          
          <div className="space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px]">Waiting for Input</p>
            <input
              placeholder="KAA-XXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full text-center text-4xl font-black tracking-[8px] text-black bg-gray-50 border-2 border-transparent focus:border-yellow-400/50 rounded-3xl py-8 outline-none transition-all placeholder:text-gray-100"
            />
            <p className="text-xs font-bold text-gray-400 px-6 leading-relaxed">
              Codes are shared via SMS or WhatsApp. Every code is unique to a single journey.
            </p>
          </div>

          <button
            disabled={code.length < 6}
            onClick={() => router.push(`/track/${code}`)}
            className={`btn w-full py-5 shadow-premium ${code.length < 6 ? 'bg-gray-100 text-gray-300' : 'btn-black'}`}
          >
            Start Live Tracking
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveTracker({ code }: { code: string }) {
  const router = useRouter();
  const mapRef = useRef<MapHandle | null>(null);
  
  // Navigation & Tracking state declarations
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapMode, setMapMode] = useState<'focus' | 'overview'>('overview');
  const [sharingBack, setSharingBack] = useState(false);
  const [activeRouteFrom, setActiveRouteFrom] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRouteTo, setActiveRouteTo] = useState<{ lat: number; lng: number } | null>(null);
  const { position: me } = useGeolocation(sharingBack || isNavigating);
  const [tracked,  setTracked]  = useState<LivePos | null>(null);
  const [session,  setSession]  = useState<Session | null>(null);
  const [ended,    setEnded]    = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [user,     setUser]     = useState<{ fullName?: string; id?: string; role?: string }>({});
  const [w3w,      setW3w]      = useState<string | null>(null);
  const [lowData,  setLowData]  = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [navSteps, setNavSteps] = useState<{ instruction: string; distance: string; duration: string; lat: number; lng: number }[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navRouteDetails, setNavRouteDetails] = useState<{ distance: string; duration: string } | null>(null);
  const [showArrivedModal, setShowArrivedModal] = useState(false);

  const lastQueryMeRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastQueryTrackedRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastQueryTimeRef = useRef<number>(0);

  const isHelper = user.role === 'helper' || user.role === 'driver';

  useEffect(() => {
    const stored = localStorage.getItem('kaalay_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => { getSessionByCode(code).then(setSession).catch(() => null); }, [code]);

  useEffect(() => {
    if (!tracked) return;
    convertTo3wa(tracked.lat, tracked.lng).then(d => setW3w(d.what3words)).catch(() => null);
  }, [tracked?.lat, tracked?.lng]);

  useEffect(() => {
    if (!sharingBack || !me || !code) return;
    const s = getSocket();
    const interval = setInterval(() => {
      s.emit('viewer-location', {
        code, viewerId: user.id || 'anon', name: user.fullName || 'Someone',
        lat: me.lat, lng: me.lng, accuracy: me.accuracy
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [sharingBack, me, code, user.id, user.fullName]);

  useSessionSocket(
    code,
    useCallback((d: LivePos) => setTracked(d), []),
    useCallback((d: any) => { 
      if (d.status === 'ended' || d.status === 'completed') setEnded(true); 
      if (d.status === 'accepted' || d.status === 'arriving' || d.status === 'arrived' || d.status === 'started') {
        setSession(s => s ? { ...s, status: d.status, driverName: d.driverName, vehicleModel: d.vehicleModel, licensePlate: d.licensePlate } : null);
      }
    }, []),
    useCallback((d: { helperName: string }) => setAccepted(d.helperName), []),
    useCallback((d: { count: number }) => setViewerCount(d.count), []),
    useCallback(() => {}, []),
  );

  // Manual Directions Recalculator Callback
  const recalculateRoute = useCallback(() => {
    if (!me || !tracked) return;

    // Update stable route coordinates passed to MapBase
    setActiveRouteFrom({ lat: me.lat, lng: me.lng });
    setActiveRouteTo({ lat: tracked.lat, lng: tracked.lng });

    if (typeof window !== 'undefined' && window.google) {
      const ds = new google.maps.DirectionsService();
      ds.route(
        {
          origin: { lat: me.lat, lng: me.lng },
          destination: { lat: tracked.lat, lng: tracked.lng },
          travelMode: google.maps.TravelMode.WALKING
        },
        (result, status) => {
          if (status === 'OK' && result?.routes[0]?.legs[0]) {
            const leg = result.routes[0].legs[0];
            setNavRouteDetails({
              distance: leg.distance?.text || '0 m',
              duration: leg.duration?.text || '0 mins'
            });
            if (leg.steps) {
              const cleanSteps = leg.steps.map((s: any) => ({
                instruction: s.instructions.replace(/<[^>]*>/g, ''),
                distance: s.distance?.text || '',
                duration: s.duration?.text || '',
                lat: typeof s.end_location?.lat === 'function' ? s.end_location.lat() : s.end_location?.lat || tracked.lat,
                lng: typeof s.end_location?.lng === 'function' ? s.end_location.lng() : s.end_location?.lng || tracked.lng
              }));
              setNavSteps(cleanSteps);
              setCurrentStepIndex(0); // Reset to first instruction on manual refresh
            }
          } else {
            // Fallback for off-road/remote regions: straight line walking guidance!
            const dKm = dist(me, tracked);
            const dStr = dKm < 1 ? `${Math.round(dKm * 1000)} m` : `${dKm.toFixed(1)} km`;
            const walkMins = Math.max(1, Math.round(dKm * 12));
            setNavRouteDetails({
              distance: dStr + ' (direct)',
              duration: `${walkMins} mins`
            });
            setNavSteps([
              {
                instruction: 'Walk straight towards the tracked person',
                distance: dStr,
                duration: `${walkMins} mins`,
                lat: tracked.lat,
                lng: tracked.lng
              }
            ]);
            setCurrentStepIndex(0);
          }
        }
      );
    }
  }, [me?.lat, me?.lng, tracked?.lat, tracked?.lng]);

  const resetNavigation = useCallback(() => {
    setIsNavigating(false);
    setMapMode('overview');
    setNavSteps([]);
    setCurrentStepIndex(0);
    setNavRouteDetails(null);
    setActiveRouteFrom(null);
    setActiveRouteTo(null);
  }, []);

  // Trigger directions calculation exactly once when navigation is engaged
  useEffect(() => {
    if (isNavigating && navSteps.length === 0) {
      recalculateRoute();
    }
  }, [isNavigating, recalculateRoute, navSteps.length]);

  // Step advancement effect
  useEffect(() => {
    if (isNavigating && me && navSteps.length > 0 && currentStepIndex < navSteps.length) {
      const nextStep = navSteps[currentStepIndex];
      const distToStepEnd = dist(me, nextStep) * 1000;
      if (distToStepEnd < 15) {
        if (currentStepIndex < navSteps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        }
      }
    }
  }, [me?.lat, me?.lng, navSteps, currentStepIndex, isNavigating]);

  // Arrival checks
  useEffect(() => {
    if (isNavigating && me && tracked) {
      const distToTracked = dist(me, tracked) * 1000;
      if (distToTracked < 12 && !showArrivedModal) {
        setShowArrivedModal(true);
      }
    }
  }, [isNavigating, me?.lat, me?.lng, tracked?.lat, tracked?.lng, showArrivedModal]);

  const km  = me && tracked ? dist(me, tracked) : null;
  const eta = km ? Math.round((km / 40) * 60) : null;

  const markers: MarkerData[] = [
    ...(me      ? [{ lat: me.lat,      lng: me.lng,      type: 'me'      as const, accuracy: me.accuracy }] : []),
    ...(tracked ? [{ lat: tracked.lat, lng: tracked.lng, heading: (tracked as any).heading, type: (session?.status === 'accepted' || session?.status === 'started' || session?.status === 'arriving') ? 'car' as const : 'tracked' as const }] : []),
  ];

  const typeMeta = TYPE_META[session?.requestType ?? 'general'] ?? TYPE_META.general;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] font-outfit relative overflow-y-auto no-scroll">
      {/* Immersive Map Background */}
      <div className="relative flex-1">
        {/* Stable Map/View Container */}
        <div className="w-full h-full relative">
          {lowData && tracked ? (
            <LowDataView me={me ?? undefined} target={tracked} w3w={w3w ?? undefined} />
          ) : (
            <MapBase 
              key="track-map-instance"
              forwardedRef={mapRef}
              center={tracked ?? me ?? { lat: -1.29, lng: 36.82 }} 
              zoom={15} 
              markers={markers}
              routeFrom={isNavigating && activeRouteFrom ? activeRouteFrom : undefined}
              routeTo={isNavigating && activeRouteTo ? activeRouteTo : (isHelper && tracked ? tracked : undefined)}
              travelMode={isNavigating ? 'WALKING' : undefined}
              zoomState={isNavigating ? (mapMode === 'overview' ? 'tracking' : 'navigation') : undefined}
              followMode={isNavigating && mapMode === 'focus'}
              onFollowModeChange={(active: boolean) => {
                if (!active && mapMode === 'focus') {
                  setMapMode('overview');
                }
              }}
              className="w-full h-full" 
            />
          )}
        </div>

        {/* Premium Floating Controls */}
        <div className="absolute top-12 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          <button 
            onClick={() => router.back()} 
            className="pointer-events-auto w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-premium active:scale-95 transition-transform"
          >
            <ArrowLeftOutlined className="text-lg text-white" />
          </button>

          <div className="pointer-events-auto bg-black px-5 h-11 rounded-full flex items-center gap-3 shadow-premium border border-white/10">
            <span className="text-[11px] font-black uppercase tracking-[2px] text-white">{code}</span>
            <div className="w-[1px] h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black text-white">{viewerCount} Live</span>
            </div>
          </div>

          <button 
            onClick={() => setLowData(!lowData)}
            className={`pointer-events-auto w-12 h-12 rounded-2xl flex items-center justify-center shadow-premium active:scale-95 transition-transform ${lowData ? 'bg-yellow-400' : 'bg-black'}`}
          >
            <GlobalOutlined className={`text-lg ${lowData ? 'text-black' : 'text-white'}`} />
          </button>
        </div>

        {/* ETA Bubble */}
        {km !== null && !ended && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-yellow-400 px-5 py-3 rounded-full shadow-premium flex items-center gap-3 animate-bounce-in">
              <ClockCircleOutlined className="text-black text-sm" />
              <p className="text-sm font-black text-black whitespace-nowrap">
                {session?.status === 'started' ? 'Trip in progress' : `${eta} min away`}
              </p>
            </div>
          </div>
        )}

        {/* Snap Button */}
        <button 
          onClick={() => tracked && mapRef.current?.panTo(tracked.lat, tracked.lng)}
          className="absolute top-28 right-4 z-40 w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-premium active:scale-95 transition-transform animate-fade-in"
        >
          <CompassOutlined className="text-lg text-white" />
        </button>

        {/* Premium View/Overview Toggle Button */}
        {isNavigating && (
          <button 
            onClick={() => setMapMode(prev => prev === 'overview' ? 'focus' : 'overview')}
            className="absolute top-44 right-4 z-40 bg-black/95 text-white px-4 py-3.5 rounded-2xl flex items-center gap-2 shadow-premium font-black text-[10px] uppercase tracking-[1.5px] border border-white/10 active:scale-95 transition-all backdrop-blur-md animate-slide-up-spring"
          >
            {mapMode === 'overview' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>🎯 Focus View</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#FFD600] animate-pulse" />
                <span>🗺️ Overview</span>
              </>
            )}
          </button>
        )}
      </div>

      {isNavigating ? (
        /* Glassmorphic Turn-by-Turn Panel */
        <div className="bg-black/95 backdrop-blur-md rounded-t-[40px] border-t border-white/10 p-6 z-50 flex flex-col gap-4 animate-slide-up-spring shadow-2xl">
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
          
          {/* Start to Finish Route Tag */}
          <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-wider flex items-center justify-between shadow-lg">
            <span className="truncate max-w-[120px] text-green-400">My Location</span>
            <ArrowRightOutlined className="text-gray-500 mx-2 text-[8px]" />
            <span className="truncate max-w-[120px] text-white">///{w3w?.split('.')[0] || 'Target'}</span>
          </div>

          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#FFD600] flex items-center justify-center text-2xl flex-shrink-0 animate-pulse border border-black/20">
              🚶‍♂️
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD600] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FFD600] animate-ping" />
                Live Walking Navigation
              </span>
              {navSteps.length > 0 && currentStepIndex < navSteps.length ? (
                <h3 className="text-base font-black text-white leading-snug mt-1 text-glow">
                  {navSteps[currentStepIndex].instruction}
                </h3>
              ) : (
                <h3 className="text-base font-black text-white leading-snug mt-1">
                  Follow the highlighted path on the map
                </h3>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-xs font-bold text-gray-400">
                  {navRouteDetails?.distance || '---'} remaining
                </p>
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <p className="text-xs font-bold text-[#FFD600]">
                  Arriving in {navRouteDetails?.duration || '---'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Step Buttons and End button */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10 mt-2">
            {navSteps.length > 1 && (
              <div className="flex gap-2">
                <button 
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex(prev => prev - 1)}
                  className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-[11px] uppercase tracking-wider transition-all"
                >
                  Prev
                </button>
                <button 
                  disabled={currentStepIndex >= navSteps.length - 1}
                  onClick={() => setCurrentStepIndex(prev => prev + 1)}
                  className="h-11 px-4 rounded-xl bg-[#FFD600] text-black font-black text-[11px] uppercase tracking-wider active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg shadow-yellow-400/20"
                >
                  Next ({currentStepIndex + 1}/{navSteps.length})
                </button>
              </div>
            )}
            
            <div className="flex gap-2 ml-auto">
              <button 
                onClick={recalculateRoute}
                className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#FFD600] font-black text-[11px] tracking-wider uppercase transition-all flex items-center gap-1.5 border border-white/10"
              >
                <RedoOutlined className="text-[10px]" />
                <span>Recalculate</span>
              </button>

              <button 
                onClick={resetNavigation}
                className="h-11 px-5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-black text-[11px] tracking-wider uppercase transition-all shadow-lg"
              >
                Cancel Nav
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Premium Coordination Sheet */
        <div className="bg-white rounded-t-[40px] shadow-sheet z-50 flex flex-col animate-slide-up-spring max-h-[75vh]">
          <div className="sheet-handle" />
          
          <div className="px-6 h-full overflow-y-auto no-scroll pb-10">
            {/* Driver En-Route Reveal */}
            {(session?.status === 'accepted' || session?.status === 'arriving') && session.driverName && (
              <div className="mb-6 p-5 bg-black rounded-[32px] shadow-premium animate-fade-in">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-yellow-400 flex items-center justify-center">
                    <CarOutlined className="text-3xl text-black" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/70">Driver approaching</span>
                    <h3 className="text-lg font-black text-white">{session.driverName}</h3>
                    <p className="text-xs font-bold text-gray-500">{session.vehicleModel} • {session.licensePlate}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                      <PhoneOutlined className="text-white text-sm" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                      <MessageOutlined className="text-white text-sm" />
                    </button>
                  </div>
                </div>
                <div className="h-0.5 bg-white/5 w-full mb-5" />
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <SafetyOutlined className="text-green-500 text-sm" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kaalay Verified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <StarFilled className="text-yellow-400 text-xs" />
                    <span className="text-xs font-black text-white">4.9</span>
                  </div>
                </div>
              </div>
            )}

            {/* Precise Location Hub */}
            {tracked && (
              <div className="bg-gray-50 rounded-[32px] p-6 mb-6 border border-gray-100 flex items-center gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-2">Target Square</p>
                  {w3w ? (
                    <h3 className="text-xl font-black text-red-600 tracking-tight truncate">///{w3w}</h3>
                  ) : (
                    <div className="h-6 w-32 bg-gray-200 rounded-lg animate-pulse" />
                  )}
                  {km !== null && (
                    <p className="text-xs font-bold text-gray-400 mt-1">
                      {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} precision coordinate
                    </p>
                  )}
                </div>
                
                {/* Coordination Compass */}
                <div className="w-16 h-16 rounded-full bg-black border-4 border-gray-200 flex items-center justify-center relative shadow-premium flex-shrink-0">
                  <div className="absolute top-1 text-[8px] font-black text-gray-500">N</div>
                  <div 
                    className="w-1 h-8 bg-yellow-400 rounded-full transition-transform duration-500"
                    style={{ transform: `rotate(${me && tracked ? bearing(me, tracked) : 0}deg)`, transformOrigin: 'center bottom', marginTop: '-16px' }}
                  />
                </div>
              </div>
            )}

            {/* Action Row */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => {
                  if (tracked) {
                    setIsNavigating(true);
                    lastQueryMeRef.current = null;
                    lastQueryTrackedRef.current = null;
                  }
                }}
                className="btn bg-gray-100 text-black py-4 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
              >
                <CompassOutlined className="text-lg text-yellow-500" />
                <span>Navigate</span>
              </button>
              
              <button 
                onClick={() => setSharingBack(!sharingBack)}
                className={`btn py-4 flex items-center justify-center gap-2 transition-all active:scale-95 ${sharingBack ? 'bg-green-500 text-white shadow-premium' : 'bg-gray-100 text-gray-400 shadow-sm'}`}
              >
                {sharingBack ? <CheckCircleFilled className="text-lg" /> : <ShareAltOutlined className="text-lg" />}
                <span>{sharingBack ? 'Sharing back' : 'Share back'}</span>
              </button>
            </div>

            {/* Driver Controls Overlay */}
            {isHelper && (
              <div className="space-y-4">
                {session?.status === 'accepted' && (
                  <button onClick={() => signalArriving(code)} className="btn btn-black w-full py-5 shadow-premium">On my way to Pickup</button>
                )}
                {session?.status === 'arriving' && (
                  <button onClick={() => signalArrived(code)} className="btn bg-green-500 text-white w-full py-5 shadow-premium">I've Arrived at Square</button>
                )}
                {session?.status === 'arrived' && (
                  <button onClick={() => startRide(code)} className="btn btn-black w-full py-5 shadow-premium">Start Precision Trip</button>
                )}
                {session?.status === 'started' && (
                  <button onClick={() => completeRide(code)} className="btn bg-yellow-400 text-black w-full py-5 shadow-premium">Complete Trip</button>
                )}
              </div>
            )}

            {/* Completion & Rating Flow */}
            {!isHelper && session?.status === 'completed' && (
              <div className="animate-fade-in space-y-6 text-center py-4">
                <div className="bg-black text-white p-8 rounded-[40px] shadow-premium">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Final Amount</p>
                  <h2 className="text-4xl font-black text-green-400 tracking-tighter">KES {session.fare || 150}</h2>
                  <div className="mt-4 px-4 py-2 bg-white/5 rounded-full inline-block">
                    <p className="text-[10px] font-bold text-gray-400">Direct cash or M-Pesa payment</p>
                  </div>
                </div>

                {!ratingSubmitted ? (
                  <div className="space-y-6 py-6">
                    <div>
                      <h3 className="text-xl font-black text-black">How was the trip?</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Rate your coordination experience</p>
                    </div>
                    <div className="flex justify-center gap-4">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          onClick={() => setRating(star)}
                          className="text-4xl transition-transform active:scale-90"
                        >
                          {rating >= star ? <StarFilled className="text-yellow-400" /> : <StarOutlined className="text-gray-100" />}
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <div className="animate-slide-up-spring space-y-4">
                        <textarea 
                          placeholder="Any feedback for the driver?"
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-transparent focus:border-yellow-400/30 rounded-[24px] p-6 text-sm font-bold outline-none h-32 resize-none"
                        />
                        <button 
                          onClick={async () => {
                            await submitRating(code, { rating, comment });
                            setRatingSubmitted(true);
                          }}
                          className="btn btn-black w-full py-5"
                        >
                          Submit Review
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-10">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircleFilled className="text-3xl text-green-500" />
                    </div>
                    <h3 className="text-lg font-black text-black">Feedback Sent</h3>
                    <p className="text-sm font-bold text-gray-400 mt-1">Thanks for helping us improve!</p>
                    <button onClick={() => router.push('/home')} className="mt-8 text-black font-black underline underline-offset-4 decoration-yellow-400">Return Home</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arrival Confirmation Modal */}
      {showArrivedModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-black/95 border border-white/15 rounded-[32px] p-8 shadow-2xl max-w-sm w-full text-center space-y-6 animate-slide-up-spring">
            <div className="w-20 h-20 rounded-full bg-[#FFD600]/10 flex items-center justify-center text-4xl mx-auto shadow-inner border border-[#FFD600]/20 animate-bounce">
              🎉
            </div>
            <div>
              <p className="text-[10px] font-black text-[#FFD600] uppercase tracking-widest leading-none">Destination Reached</p>
              <h2 className="text-2xl font-black text-white mt-3 leading-none">You Have Arrived!</h2>
              <p className="text-xs font-bold text-gray-400 mt-2 leading-relaxed">
                You have successfully completed your journey and met up.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button 
                onClick={() => {
                  setShowArrivedModal(false);
                  resetNavigation();
                }}
                className="w-full py-4 rounded-2xl bg-[#FFD600] hover:bg-[#FFD600]/90 active:scale-95 text-black font-black text-sm transition-all shadow-lg"
              >
                CLOSE DIRECTIONS
              </button>
              <button 
                onClick={() => setShowArrivedModal(false)}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs tracking-wider uppercase transition-all"
              >
                KEEP MAP OPEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Ended Overlay */}
      {ended && (
        <div className="fixed inset-0 z-[1000] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="w-24 h-24 bg-gray-100 rounded-[32px] flex items-center justify-center mb-8">
            <EnvironmentOutlined className="text-4xl text-gray-300" />
          </div>
          <h2 className="text-3xl font-black text-black tracking-tighter mb-2">Journey Ended</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-12">Live sharing has expired</p>
          <button 
            onClick={() => router.push('/home')}
            className="btn btn-black w-full py-5 shadow-premium max-w-xs"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

