'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Badge } from 'antd';
import {
  MenuOutlined, BellOutlined, ShareAltOutlined,
  AlertOutlined, SearchOutlined, TeamOutlined, CarOutlined,
  EnvironmentOutlined, RadarChartOutlined, UserOutlined,
  CompassOutlined, GlobalOutlined, InfoCircleOutlined,
  CreditCardOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, LoadingOutlined, ArrowRightOutlined, ArrowLeftOutlined,
  CheckCircleFilled, FireFilled, AimOutlined, PlusOutlined, CloseOutlined
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useAuth } from '../../context/AuthContext';
import { useShare } from '../../context/ShareContext';
import { acceptRide, requestRide, convertToWords, getPlaces, createPlace } from '../../lib/api';
import type { MarkerData } from '../../components/MapBase';
import NavigationSheet, { LocationPoint } from '../../components/NavigationSheet';
import { useSocket } from '../../hooks/useSocket';

const MapBase = dynamic(() => import('../../components/MapBase').then((mod) => {
  const Component = mod.default;
  return function MapBaseWrapper({ forwardedRef, ...props }: any) {
    return <Component ref={forwardedRef} {...props} />;
  };
}), { ssr: false });

interface Session {
  id: string; 
  shareCode?: string; 
  latitude?: number; 
  longitude?: number;
  pickupLat?: number;
  pickupLng?: number;
  requestType?: string; 
  destinationWhat3words?: string; 
  pickupWhat3words?: string;
  rider?: { fullName: string };
  user?: { fullName: string };
  message?: string;
  type?: string;
  role?: string;
}

const RIDE_TYPES = [
  { id: 'economy', label: 'Kaalay Taxi', priceMult: 1.0, imgUrl: '/icon-taxi.png', eta: '4 min' },
  { id: 'pro',     label: 'Kaalay Bike', priceMult: 0.6, imgUrl: '/icon-bike.png', eta: '2 min' },
  { id: 'help',    label: 'Kaalay Help', priceMult: 0.8, imgUrl: '/icon-person.png', eta: '5 min' },
  { id: 'walking', label: 'Walk & Navigate', priceMult: 0.0, imgUrl: '/icon-person.png', eta: '0 min' },
];

const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

export default function HomePage() {
  const router = useRouter();
  const { position } = useGeolocation(false);
  const { user, loading: authLoading } = useAuth();
  const { isLive } = useShare();
  const socketRef = useSocket();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sheetH,   setSheetH]   = useState<'peek' | 'half' | 'full' | 'hidden'>('peek');
  const [isOnline, setIsOnline] = useState(false);
  
  // High-fidelity driver notification stack
  const [incomingRequests, setIncomingRequests] = useState<Session[]>([]);
  const activePopup = useMemo(() => incomingRequests[0] || null, [incomingRequests]);

  const [showNavSheet, setShowNavSheet] = useState(false);
  const [routeDest, setRouteDest] = useState<LocationPoint | null>(null);
  const [routeStart, setRouteStart] = useState<LocationPoint | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; priceBase: number } | null>(null);
  const [selectedRide, setSelectedRide] = useState('economy');
  const [isRequesting, setIsRequesting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Premium Fixed Center Pin States
  const mapRef = useRef<any>(null);
  const [centerPinAddress, setCenterPinAddress] = useState<{ words: string; lat: number; lng: number } | null>(null);
  const [isPinResolving, setIsPinResolving] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [zoomState, setZoomState] = useState<'city' | 'pickup' | 'tracking' | 'navigation' | undefined>('pickup');
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);

  // Custom named places states
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [isSavePlaceModalOpen, setIsSavePlaceModalOpen] = useState(false);
  const [savePlaceName, setSavePlaceName] = useState('');
  const [savePlaceDescription, setSavePlaceDescription] = useState('');
  const [savePlaceCategory, setSavePlaceCategory] = useState('other');
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [selectedPlaceInfo, setSelectedPlaceInfo] = useState<any | null>(null);

  // Map selection mode state for Plan Journey inputs
  const [pickingLocationType, setPickingLocationType] = useState<'start' | 'dest' | null>(null);

  const handleConfirmMapPinSelection = () => {
    if (!centerPinAddress) return;
    const point: LocationPoint = {
      lat: centerPinAddress.lat,
      lng: centerPinAddress.lng,
      label: `///${centerPinAddress.words}`,
      isW3W: true
    };
    if (pickingLocationType === 'start') {
      setRouteStart(point);
    } else if (pickingLocationType === 'dest') {
      setRouteDest(point);
    }
    setPickingLocationType(null);
    setShowNavSheet(true); // Re-open NavigationSheet!
  };

  const handleCenterPinChange = async (lat: number, lng: number) => {
    // Only resolve pin coordinate to what3words when not in active route routing, or when manually selecting point on map
    if (routeDest && !pickingLocationType) return;
    setIsPinResolving(true);
    try {
      const data = await convertToWords(lat, lng);
      setCenterPinAddress({ words: data.words, lat, lng });
      if (pickingLocationType === 'dest') {
        // Just resolve address for dest, do not set routeStart
      } else {
        setRouteStart({ lat, lng, label: `///${data.words}` });
      }
    } catch (err) {
      console.error('Reverse geocode failed:', err);
    } finally {
      setIsPinResolving(false);
    }
  };

  const handleCalculateRoute = useCallback(async (start: LocationPoint, dest: LocationPoint) => {
    setRouteStart(start);
    setRouteDest(dest); 
    setShowNavSheet(false); 
    setSheetH('half'); 
    setZoomState('tracking'); // Set auto zoom to tracking mode
    try { 
      const service = new google.maps.DirectionsService();
      const res = await service.route({
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      });
      
      if (res.routes[0]?.legs[0]) {
        const leg = res.routes[0].legs[0];
        const distanceText = leg.distance?.text || '0 km';
        const durationText = leg.duration?.text || '0 min';
        const distNum = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
        
        setRouteInfo({ 
          distance: distanceText, 
          duration: durationText, 
          priceBase: distNum * 50 + 50 
        });
      }
    } catch (err) { 
      console.error('Directions error, using off-road haversine fallback:', err); 
      const distNum = getHaversineDistance(start.lat, start.lng, dest.lat, dest.lng);
      const distanceText = `${distNum.toFixed(1)} km (direct)`;
      // Driving off-road assumes slower speed (~20-25 km/h)
      const durationMins = Math.max(1, Math.round(distNum * 2.5));
      const durationText = `${durationMins} min`;
      setRouteInfo({
        distance: distanceText,
        duration: durationText,
        priceBase: distNum * 50 + 50
      });
    }
  }, []);

  const fetchPlaces = useCallback(async () => {
    try {
      const places = await getPlaces();
      setSavedPlaces(places || []);
    } catch (err) {
      console.error("Failed to load saved custom places", err);
    }
  }, []);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleRequestRide = async () => {
    if (!routeStart || !routeDest || !routeInfo) return;
    setIsRequesting(true);
    try {
      const distanceVal = parseFloat(routeInfo.distance.replace(/[^0-9.]/g, '')) || 0;
      const durationVal = parseFloat(routeInfo.duration.replace(/[^0-9.]/g, '')) || 0;

      if (selectedRide === 'walking') {
        const walkEtaMins = Math.round(distanceVal * 12) || 5;
        const walkDuration = `${walkEtaMins} min`;
        
        router.push(`/ride?rideId=walking` +
          `&mode=walking` +
          `&pickupLat=${routeStart.lat}` +
          `&pickupLng=${routeStart.lng}` +
          `&pickupW3w=${encodeURIComponent(routeStart.label || '')}` +
          `&destLat=${routeDest.lat}` +
          `&destLng=${routeDest.lng}` +
          `&destW3w=${encodeURIComponent(routeDest.label || '')}` +
          `&category=walking` +
          `&price=0` +
          `&distance=${encodeURIComponent(routeInfo.distance)}` +
          `&duration=${encodeURIComponent(walkDuration)}`
        );
        return;
      }

      const ride = await requestRide({
        pickup: { lat: routeStart.lat, lng: routeStart.lng, words: routeStart.label || `${routeStart.lat},${routeStart.lng}` },
        destination: { lat: routeDest.lat, lng: routeDest.lng, words: routeDest.label || `${routeDest.lat},${routeDest.lng}` },
        category: selectedRide,
        distance: distanceVal,
        duration: durationVal,
      });
      
      const priceMult = RIDE_TYPES.find(r => r.id === selectedRide)?.priceMult || 1.0;
      const calculatedPrice = (routeInfo.priceBase * priceMult).toFixed(0);

      if (socketRef.current) {
         socketRef.current.emit('join', ride.id);
         socketRef.current.emit('broadcast-request', {
            id: ride.id,
            shareCode: ride.id,
            pickupLat: routeStart.lat,
            pickupLng: routeStart.lng,
            destinationWhat3words: routeDest.label || 'destination',
            rider: { fullName: user?.fullName || 'Rider' },
            status: 'requested',
            category: selectedRide,
            fare: Number(calculatedPrice)
         });
      }
      
      router.push(`/ride?rideId=${ride.id}` +
        `&pickupLat=${routeStart.lat}` +
        `&pickupLng=${routeStart.lng}` +
        `&pickupW3w=${encodeURIComponent(routeStart.label || '')}` +
        `&destLat=${routeDest.lat}` +
        `&destLng=${routeDest.lng}` +
        `&destW3w=${encodeURIComponent(routeDest.label || '')}` +
        `&category=${selectedRide}` +
        `&price=${calculatedPrice}` +
        `&distance=${encodeURIComponent(routeInfo.distance)}` +
        `&duration=${encodeURIComponent(routeInfo.duration)}`
      );
    } catch (err) {
      console.error('Ride request failed:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    if (!socketRef.current) return;
    const s = socketRef.current;

    const onNewRequest = (data: any) => {
      setIncomingRequests(prev => {
        if (prev.find(r => r.id === data.id)) return prev;
        return [data, ...prev];
      });
      setSessions(prev => {
        if (prev.find(s => s.id === data.id)) return prev;
        return [data, ...prev];
      });
    };

    const onRequestClaimed = (data: { id: string; shareCode: string }) => {
      const id = data.id || data.shareCode;
      setIncomingRequests(prev => prev.filter(r => r.id !== id && r.shareCode !== id));
      setSessions(prev => prev.filter(s => s.id !== id && s.shareCode !== id));
    };

    s.on('new-request', onNewRequest);
    s.on('request-claimed', onRequestClaimed);
    s.on('request-cancelled', onRequestClaimed);
    return () => { 
      s.off('new-request', onNewRequest); 
      s.off('request-claimed', onRequestClaimed);
      s.off('request-cancelled', onRequestClaimed);
    };
  }, [socketRef]);

  const handleAccept = async (request: Session) => {
    const code = request.id || request.shareCode;
    if (!code) return;
    try {
      await acceptRide(code);
      setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
      router.push(`/track/${code}`);
    } catch (err) {
      console.error("Failed to accept ride", err);
    }
  };

  const toggleOnline = () => {
    if (!socketRef.current) return;
    if (!isOnline) {
      socketRef.current.emit('go-online', { driverId: user?.id });
      setIsOnline(true);
    } else {
      socketRef.current.emit('go-offline');
      setIsOnline(false);
    }
  };

  useEffect(() => {
    if (!socketRef.current || !position || !isOnline || !user) return;
    socketRef.current.emit('update-location', { 
      lat: position.lat, 
      lng: position.lng,
      driverId: user.id,
      name: user.fullName,
      role: 'driver'
    });
  }, [position, isOnline, socketRef, user]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth'); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!socketRef.current) return;
    const s = socketRef.current;
    const onNotif = () => setUnreadCount(c => c + 1);
    s.on('notification', onNotif);
    return () => { s.off('notification', onNotif); };
  }, [socketRef]);

  const { manualPosition } = useShare();
  const center = mapFocus || manualPosition || position || { lat: -1.2921, lng: 36.8219 };
  const isHelper = user?.role === 'helper' || user?.role === 'driver';

  // Auto-pan to position when it's acquired initially
  useEffect(() => {
    if (position && !mapFocus && !routeDest && !routeStart) {
      setMapFocus({ lat: position.lat, lng: position.lng });
      mapRef.current?.panTo(position.lat, position.lng);
    }
  }, [position]);

  const markers: MarkerData[] = useMemo(() => [
    ...(position ? [{
      lat: position.lat,
      lng: position.lng,
      type: isHelper ? 'car' as const : 'me' as const,
      accuracy: isHelper ? undefined : position.accuracy,
      category: isHelper ? (user?.vehicleCategory || 'economy') : undefined,
      label: isHelper ? (user?.fullName || 'Me') : undefined,
    }] : []),
    ...sessions.map(s => ({
      lat: Number(s.pickupLat || s.latitude),
      lng: Number(s.pickupLng || s.longitude),
      type: (s.role === 'driver' ? 'car' : 'request') as any,
      label: s.rider?.fullName || s.user?.fullName
    })),
    ...(routeDest ? [{ lat: routeDest.lat, lng: routeDest.lng, type: 'request' as const, label: routeDest.label }] : []),
    ...savedPlaces.map(p => ({
      lat: p.latitude,
      lng: p.longitude,
      type: 'place' as const,
      label: p.name,
      words: p.words,
      placeId: p.id,
      onClick: () => {
        setSelectedPlaceInfo(p);
        setSheetH('peek'); // minimize panel to reveal details
      }
    })),
  ], [position, sessions, routeDest, isHelper, user, savedPlaces]);

  const sheetTranslate = sheetH === 'peek' ? 'calc(100% - 320px)' : sheetH === 'half' ? 'calc(100% - 560px)' : sheetH === 'hidden' ? '100%' : '0px';

  return (
    <div className="h-full relative overflow-hidden bg-white font-outfit">
      {/* Immersive Map Background */}
      <div className="absolute inset-x-0 top-0 bottom-[275px] z-0">
        <MapBase 
          forwardedRef={mapRef}
          center={center} 
          zoom={16} 
          markers={markers} 
          routeFrom={position ? { lat: position.lat, lng: position.lng } : (routeStart ? { lat: routeStart.lat, lng: routeStart.lng } : undefined)}
          routeTo={routeDest ? { lat: routeDest.lat, lng: routeDest.lng } : undefined} 
          isSelectingPickup={(!routeDest || !!pickingLocationType) && !isHelper}
          onCenterPinChange={handleCenterPinChange}
          followMode={followMode}
          onFollowModeChange={setFollowMode}
          zoomState={zoomState}
          className="w-full h-full" 
          onClick={() => {
            if (routeDest) setSheetH('half');
            else setSheetH('peek');
          }} 
        />

        {pickingLocationType && (
          <>
            {/* Top Selection Instructions Card */}
            <div className="absolute top-12 left-4 right-4 z-40 bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex items-center justify-between shadow-premium animate-slide-down">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center flex-shrink-0 animate-pulse">
                  📍
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-yellow-400">Map Precision Picker</p>
                  <h3 className="text-xs font-black text-white leading-tight">
                    Aim at {pickingLocationType === 'start' ? 'Pickup' : 'Destination'}
                  </h3>
                </div>
              </div>
              <div className="text-[10px] font-bold text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 truncate max-w-[150px]">
                {isPinResolving ? (
                  <span className="flex items-center gap-1.5"><LoadingOutlined /> Locating...</span>
                ) : (
                  centerPinAddress ? `///${centerPinAddress.words}` : 'Choose spot...'
                )}
              </div>
            </div>

            {/* Bottom Floating Map Confirm Pin Action */}
            <div className="absolute bottom-6 left-6 right-6 z-40 animate-slide-up-spring">
              <button 
                disabled={isPinResolving || !centerPinAddress}
                onClick={handleConfirmMapPinSelection}
                className="w-full h-14 bg-[#FFD600] active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all rounded-2xl flex items-center justify-center gap-3 border border-black shadow-lg"
              >
                {isPinResolving ? (
                  <LoadingOutlined className="text-black text-lg" />
                ) : (
                  <span className="text-sm font-black text-black uppercase tracking-wider">Confirm {pickingLocationType === 'start' ? 'Pickup' : 'Destination'}</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Premium Floating Circular Map Controls */}
      <div className="absolute right-6 bottom-[335px] z-20 flex flex-col gap-3 pointer-events-none">
        {/* Compass Rotate back to North Button */}
        <button 
          onClick={() => {
            const map = mapRef.current?.getMap();
            if (map) map.setHeading(0);
          }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-all border border-gray-50 hover:bg-gray-50 pointer-events-auto"
        >
          <CompassOutlined className="text-lg text-black" />
        </button>

        {/* Dynamic Zoom In */}
        <button 
          onClick={() => {
            const map = mapRef.current?.getMap();
            if (map) {
              const cz = map.getZoom() || 16;
              map.setZoom(cz + 1);
            }
          }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-all border border-gray-50 hover:bg-gray-50 pointer-events-auto text-lg font-black"
        >
          +
        </button>

        {/* Dynamic Zoom Out */}
        <button 
          onClick={() => {
            const map = mapRef.current?.getMap();
            if (map) {
              const cz = map.getZoom() || 16;
              map.setZoom(cz - 1);
            }
          }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-all border border-gray-50 hover:bg-gray-50 pointer-events-auto text-lg font-black"
        >
          −
        </button>

        {/* GPS Location follow mode Lock Button */}
        <button 
          onClick={() => {
            setFollowMode(true);
            if (position) {
              setMapFocus({ lat: position.lat, lng: position.lng });
              mapRef.current?.panTo(position.lat, position.lng);
            }
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-all border border-gray-50 pointer-events-auto ${
            followMode ? 'bg-[#FFD600] text-black border-yellow-400 font-bold' : 'bg-white text-black hover:bg-gray-50'
          }`}
        >
          <AimOutlined className={`text-lg ${followMode ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* Floating Driver Notification Popup */}
      {isOnline && activePopup && (
        <div className="fixed top-24 left-6 right-6 z-[60] animate-bounce-in">
          <div className="glass-premium p-6 rounded-[32px] border-2 border-yellow-400 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
                  <FireFilled className="text-xl text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Precision Request</p>
                  <h3 className="text-lg font-black text-black leading-tight">{activePopup.rider?.fullName || activePopup.user?.fullName}</h3>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-yellow-600">///{activePopup.pickupWhat3words || 'exact.spot'}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">2 min away</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIncomingRequests(prev => prev.filter(r => r.id !== activePopup.id))}
                className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-400 font-black text-sm active:scale-95 transition-transform"
              >
                IGNORE
              </button>
              <button 
                onClick={() => handleAccept(activePopup)}
                className="flex-[2] py-4 rounded-2xl bg-black text-white font-black text-sm shadow-premium active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <CheckCircleFilled className="text-white" />
                ACCEPT JOURNEY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Overlay (Always Mounted) */}
      <div className={`absolute top-12 left-0 right-0 px-6 flex items-center justify-between z-30 transition-opacity duration-300 ${!routeDest ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-premium active:scale-90 transition-transform">
          <MenuOutlined className="text-xl text-white" />
        </button>

        <div className="px-5 py-2.5 bg-black rounded-full shadow-premium flex items-center gap-3 border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-[11px] font-black uppercase tracking-[2px] text-white">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <button onClick={() => { setUnreadCount(0); router.push('/notifications'); }} className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-premium active:scale-90 transition-transform">
          <Badge count={unreadCount} offset={[2, -2]} size="small" color="#FFD600">
            <BellOutlined className="text-xl text-white" />
          </Badge>
        </button>
      </div>

      {/* Ride Selection Overlay Sheet (Always Mounted) */}
      <div className={`fixed bottom-0 left-0 right-0 z-[100] bg-white rounded-t-[40px] shadow-sheet flex flex-col max-h-[85vh] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${(routeDest && routeInfo) ? 'translate-y-0' : 'translate-y-full'}`}>
        {routeInfo && (
          <>
            <div className="sheet-handle" />
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
              <button 
                onClick={() => { setRouteDest(null); setZoomState('pickup'); }} 
                className="w-10 h-10 glass rounded-xl flex items-center justify-center"
              >
                <ArrowLeftOutlined className="text-black" />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-black text-black leading-tight">Choose a Ride</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{routeInfo.distance} · {routeInfo.duration}</p>
              </div>
              <button onClick={() => router.push('/ride/settings')} className="w-10 h-10 glass rounded-xl flex items-center justify-center">
                <CreditCardOutlined className="text-black" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scroll px-6 py-6 space-y-4">
              {RIDE_TYPES.map(ride => (
                <button 
                  key={ride.id}
                  onClick={() => setSelectedRide(ride.id)}
                  className={`w-full flex items-center gap-5 p-5 rounded-[28px] text-left transition-all duration-300 border-2 ${
                    selectedRide === ride.id 
                    ? 'bg-black border-black shadow-premium' 
                    : 'bg-gray-50 border-transparent'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedRide === ride.id ? 'bg-yellow-400' : 'bg-white shadow-sm'}`}>
                    <img src={ride.imgUrl} alt={ride.label} className="w-10 h-10 object-contain drop-shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-base font-black ${selectedRide === ride.id ? 'text-white' : 'text-black'}`}>{ride.label}</p>
                      <div className="px-1.5 py-0.5 bg-green-500 rounded flex items-center gap-1">
                        <ClockCircleOutlined className="text-[8px] text-white" />
                        <span className="text-[8px] font-black text-white">{ride.eta}</span>
                      </div>
                    </div>
                    <p className={`text-xs font-bold ${selectedRide === ride.id ? 'text-gray-400' : 'text-gray-500'}`}>Standard 4-seat ride</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${selectedRide === ride.id ? 'text-white' : 'text-black'}`}>
                      KES {(routeInfo.priceBase * ride.priceMult).toFixed(0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-6 bg-white border-t border-gray-50">
              <button 
                disabled={isRequesting}
                onClick={handleRequestRide}
                className="btn btn-black w-full shadow-premium py-5 group h-16"
              >
                {isRequesting ? <LoadingOutlined className="text-xl" /> : (
                  <>
                    <span className="text-lg">Confirm {RIDE_TYPES.find(r => r.id === selectedRide)?.label}</span>
                    <ArrowRightOutlined className="text-sm group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main Bottom Sheet (Always Mounted) */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-[32px] shadow-sheet transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${routeDest ? 'translate-y-full pointer-events-none' : ''}`}
        style={!routeDest ? { height: '92%', transform: `translateY(${sheetTranslate})` } : { height: '92%' }}
      >
        <div 
          className="cursor-pointer pb-2"
          onClick={() => setSheetH(h => h === 'peek' ? 'half' : h === 'half' ? 'full' : 'peek')}
        >
          <div className="sheet-handle" />
          <div className="px-6 py-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-0.5">Kaalay Hub</p>
              <h2 className="text-2xl font-black text-black tracking-tighter">
                {user?.fullName?.split(' ')[0] ?? 'Hello'}
              </h2>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); router.push('/profile'); }}
              className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-premium active:scale-95 transition-transform"
            >
              <span className="text-lg font-black text-white">
                {user?.fullName?.charAt(0).toUpperCase() ?? <UserOutlined className="text-white" />}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 h-full overflow-y-auto no-scroll pb-28">
          {isHelper && (
            <div className="mb-6">
              <button 
                onClick={toggleOnline}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm transition-all shadow-premium ${isOnline ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-900'}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
                {isOnline ? 'Precision Radar Active' : 'Go Online to Receive'}
              </button>
            </div>
          )}

          {/* 3. PREMIUM FIXED PIN INTERACTIVE ADDRESS CARD AND SEARCH CONTROL */}
          {!isHelper && (
            <div className="mb-4 space-y-3">
              {/* Custom what3words selector banner */}
              <div className="glass-premium p-4 rounded-[24px] border border-gray-100 flex items-center justify-between shadow-premium transition-all duration-300">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <EnvironmentOutlined className="text-red-500 text-lg animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pin Pickup Location</p>
                    {isPinResolving ? (
                      <div className="h-5 w-36 shimmer-bg rounded mt-1.5" />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <h3 className="text-base font-black text-red-600 truncate leading-none">
                          {centerPinAddress ? `///${centerPinAddress.words}` : 'Locating precise spot...'}
                        </h3>
                      </div>
                    )}
                  </div>
                </div>
                {!isPinResolving && centerPinAddress && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsSavePlaceModalOpen(true)}
                      className="w-10 h-10 bg-yellow-50 hover:bg-yellow-100 rounded-xl flex items-center justify-center border border-yellow-100 pointer-events-auto text-[#FFD600] active:scale-90 transition-transform"
                      title="Name this Place"
                    >
                      <PlusOutlined className="text-black text-sm" />
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`///${centerPinAddress.words}`);
                      }} 
                      className="w-10 h-10 bg-gray-50 hover:bg-gray-100 active:scale-90 rounded-xl flex items-center justify-center transition-all border border-gray-100 pointer-events-auto"
                      title="Copy Address"
                    >
                      <ShareAltOutlined className="text-black text-sm" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action grid (Search Destination vs Confirm Pickup Location) */}
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowNavSheet(true)}
                  className="flex-[2] btn btn-yellow font-black text-xs tracking-widest shadow-premium py-4"
                >
                  <SearchOutlined /> SEARCH DESTINATION
                </button>
                <button 
                  onClick={() => {
                    if (centerPinAddress) {
                      setRouteStart({ lat: centerPinAddress.lat, lng: centerPinAddress.lng, label: `///${centerPinAddress.words}` });
                      setShowNavSheet(true);
                    }
                  }}
                  className="flex-1 btn btn-black font-black text-[10px] tracking-wider py-4 whitespace-nowrap"
                >
                  CONFIRM SPOT
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-black">
              {isHelper ? 'Live Request Queue' : 'Active Grid'}
            </h3>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-extrabold text-gray-900 uppercase">{sessions.length} Active</span>
            </div>
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                  <RadarChartOutlined className="text-2xl text-gray-200" />
                </div>
                <p className="text-sm font-bold text-gray-300">Scanning for live precision data...</p>
              </div>
            ) : (
              sessions.map(s => (
                <div 
                  key={s.id} 
                  className="w-full flex items-center gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-[24px] text-left group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                    {s.role === 'driver' ? <CarOutlined className="text-black" /> : <UserOutlined className="text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-black truncate">{s.user?.fullName || s.rider?.fullName || 'Anonymous'}</p>
                    <p className="text-[10px] text-yellow-600 font-black tracking-tight truncate uppercase mt-0.5">///{s.pickupWhat3words || 'active.spot'}</p>
                  </div>
                  {isHelper && (
                    <button 
                      onClick={() => handleAccept(s)}
                      className="btn-black !rounded-xl !p-3 !text-[10px] !font-black !tracking-widest"
                    >
                      ACCEPT
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Navigation Overlay Sheet (Always Mounted to prevent DOM crash) */}
      <NavigationSheet 
        isVisible={showNavSheet}
        currentLocation={routeStart || (position ? { lat: position.lat, lng: position.lng } : undefined)} 
        initialStartPoint={routeStart}
        initialDestPoint={routeDest}
        onClose={() => setShowNavSheet(false)} 
        onRouteSubmit={handleCalculateRoute} 
        onPickOnMapStart={() => {
          setPickingLocationType('start');
          setShowNavSheet(false);
        }}
        onPickOnMapDest={() => {
          setPickingLocationType('dest');
          setShowNavSheet(false);
        }}
      />

      {/* Save Place Modal */}
      {isSavePlaceModalOpen && centerPinAddress && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 border border-white/20 shadow-2xl relative">
            <button 
              onClick={() => {
                setIsSavePlaceModalOpen(false);
                setSavePlaceName('');
                setSavePlaceDescription('');
                setSavePlaceCategory('other');
              }}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <CloseOutlined className="text-sm" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">Custom Registry</span>
              <h3 className="text-2xl font-black text-black tracking-tight mt-1">Name this Place</h3>
              <p className="text-xs font-bold text-gray-500 mt-1.5">
                Saved locations are pinned for all users and searchable by their custom name.
              </p>
            </div>

            <div className="mb-6 p-4 bg-red-50/50 rounded-2xl border border-red-50 flex items-center gap-3">
              <EnvironmentOutlined className="text-red-500 text-base" />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-wider text-red-400">what3words precise address</p>
                <p className="text-sm font-black text-red-600 truncate">///{centerPinAddress.words}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">Place Name *</label>
                <div className="input-container !bg-gray-50 !h-12 !border-gray-200">
                  <input
                    placeholder="e.g. My Favorite Coffee Shop"
                    value={savePlaceName}
                    onChange={(e) => setSavePlaceName(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">Description (Optional)</label>
                <div className="input-container !bg-gray-50 !h-12 !border-gray-200">
                  <input
                    placeholder="e.g. Cozy spot with great wifi"
                    value={savePlaceDescription}
                    onChange={(e) => setSavePlaceDescription(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-black placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'home', label: 'Home' },
                    { id: 'work', label: 'Work' },
                    { id: 'hangout', label: 'Hangout' },
                    { id: 'food', label: 'Food & Drink' },
                    { id: 'shop', label: 'Shop' },
                    { id: 'other', label: 'Other' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSavePlaceCategory(cat.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        savePlaceCategory === cat.id
                        ? 'bg-black text-white shadow-premium'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                disabled={isSavingPlace}
                onClick={() => {
                  setIsSavePlaceModalOpen(false);
                  setSavePlaceName('');
                  setSavePlaceDescription('');
                  setSavePlaceCategory('other');
                }}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-black font-black text-sm rounded-2xl active:scale-95 transition-all"
              >
                CANCEL
              </button>
              <button
                disabled={isSavingPlace || !savePlaceName.trim()}
                onClick={async () => {
                  if (!savePlaceName.trim()) return;
                  setIsSavingPlace(true);
                  try {
                    await createPlace({
                      name: savePlaceName.trim(),
                      description: savePlaceDescription.trim() || undefined,
                      lat: centerPinAddress.lat,
                      lng: centerPinAddress.lng,
                      words: centerPinAddress.words,
                      tags: [savePlaceCategory]
                    });
                    await fetchPlaces();
                    setIsSavePlaceModalOpen(false);
                    setSavePlaceName('');
                    setSavePlaceDescription('');
                    setSavePlaceCategory('other');
                  } catch (err) {
                    console.error("Save place failed", err);
                  } finally {
                    setIsSavingPlace(false);
                  }
                }}
                className="flex-[2] py-4 bg-black disabled:bg-gray-100 disabled:text-gray-300 text-white font-black text-sm rounded-2xl shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSavingPlace ? <LoadingOutlined /> : <CheckCircleFilled />}
                SAVE TO MAP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Place Info Banner */}
      {selectedPlaceInfo && (
        <div className="fixed bottom-[320px] left-6 right-6 z-40 animate-slide-up">
          <div className="glass-premium p-5 rounded-[28px] border border-white/20 shadow-2xl flex flex-col gap-4 relative overflow-hidden bg-white/95">
            <button 
              onClick={() => setSelectedPlaceInfo(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <CloseOutlined className="text-xs" />
            </button>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <EnvironmentOutlined className="text-[#8E2DE2] text-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-black leading-tight truncate">{selectedPlaceInfo.name}</h4>
                  <span className="px-2 py-0.5 bg-purple-50 text-[#8E2DE2] text-[8px] font-black uppercase rounded-md tracking-wider">
                    {selectedPlaceInfo.tags?.[0] || 'Saved Place'}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-500 mt-1 leading-snug">
                  {selectedPlaceInfo.description || 'Custom saved spot.'}
                </p>
                <p className="text-[10px] font-black text-red-500 mt-1.5 uppercase tracking-wide">
                  ///{selectedPlaceInfo.words}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const startPointObj = { 
                    lat: selectedPlaceInfo.latitude, 
                    lng: selectedPlaceInfo.longitude, 
                    label: selectedPlaceInfo.name 
                  };
                  setRouteStart(startPointObj);
                  setSelectedPlaceInfo(null);
                  if (routeDest) {
                    handleCalculateRoute(startPointObj, routeDest);
                  } else {
                    setShowNavSheet(true);
                  }
                }}
                className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-black font-black text-xs tracking-wider rounded-xl active:scale-95 transition-all border border-gray-100 uppercase"
              >
                Set as Pickup
              </button>
              <button 
                onClick={() => {
                  const startPointObj = routeStart || (position ? { 
                    lat: position.lat, 
                    lng: position.lng, 
                    label: 'Your Current Location' 
                  } : null);
                  const destPointObj = { 
                    lat: selectedPlaceInfo.latitude, 
                    lng: selectedPlaceInfo.longitude, 
                    label: selectedPlaceInfo.name 
                  };
                  setRouteDest(destPointObj);
                  setSelectedPlaceInfo(null);
                  if (startPointObj) {
                    setRouteStart(startPointObj);
                    handleCalculateRoute(startPointObj, destPointObj);
                  } else {
                    setShowNavSheet(true);
                  }
                }}
                className="flex-1 py-3.5 bg-black hover:bg-neutral-900 text-white font-black text-xs tracking-wider rounded-xl active:scale-95 transition-all shadow-premium uppercase"
              >
                Set as Destination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
