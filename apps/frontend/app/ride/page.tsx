'use client';
import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Autocomplete } from '@react-google-maps/api';
import { useGoogleMaps } from '../../components/GoogleMapsProvider';
import {
  CheckOutlined, LoadingOutlined, DollarOutlined, SwapOutlined,
  EnvironmentFilled, AimOutlined, RadarChartOutlined, CloseOutlined, ArrowRightOutlined, PlusOutlined,
  ClockCircleOutlined, UserOutlined, ShoppingOutlined, DownOutlined, CalendarOutlined, ThunderboltFilled,
  ArrowLeftOutlined, CarOutlined, EnvironmentOutlined, CompassOutlined
} from '@ant-design/icons';
import { useGeolocation } from '../../hooks/useGeolocation';
import { convertTo3wa, requestRide, cancelRide, getFareEstimates } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { MarkerData } from '../../components/MapBase';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'what3words-autosuggest': any;
    }
  }
}

const MapBase = dynamic(() => import('../../components/MapBase').then((mod) => {
  const Component = mod.default;
  return function MapBaseWrapper({ forwardedRef, ...props }: any) {
    return <Component ref={forwardedRef} {...props} />;
  };
}), { ssr: false });

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

const bearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): number => {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};

const getCardinalDirection = (angle: number): string => {
  const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
  const index = Math.round(((angle % 360) / 45)) % 8;
  return directions[index];
};

function RidePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { position } = useGeolocation(true);
  const { isLoaded } = useGoogleMaps();
  
  const [step,     setStep]     = useState<'select' | 'confirm' | 'waiting' | 'active' | 'walking'>('select');
  const [pickup,   setPickup]   = useState<{ w3w: string; lat: number; lng: number } | null>(null);
  const [dest,     setDest]     = useState<{ w3w: string; lat: number; lng: number } | null>(null);
  const [destIn,   setDestIn]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [price, setPrice] = useState<number>(0);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('economy');
  const [rideId,   setRideId]   = useState<string | null>(null);
  const [driver,   setDriver]   = useState<any>(null);
  const [acceptedNotif, setAcceptedNotif] = useState(false);
  const [multiModal, setMultiModal] = useState<{ [key: string]: { dist: string; dur: string } }>({});
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [pickingOnMap, setPickingOnMap] = useState<'pickup' | 'dest' | null>(null);
  const startAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const w3wAutoRef = useRef<HTMLElement>(null);
  const mapRef = useRef<any>(null);
  const [tempCoords, setTempCoords] = useState<{ w3w: string; lat: number; lng: number } | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const resolveTimeoutRef = useRef<any>(null);
  const [isPickupManual, setIsPickupManual] = useState(false);
  const [navSteps, setNavSteps] = useState<{ instruction: string; distance: string; duration: string; lat: number; lng: number }[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [w3wSuggestions, setW3wSuggestions] = useState<any[]>([]);
  const [navMode, setNavMode] = useState<'smart' | 'hybrid' | 'precision'>('smart');
  const [isOffRoad, setIsOffRoad] = useState(false);

  const loadEstimates = useCallback(async (distNum: number) => {
    try {
      const ests = await getFareEstimates({ distance: distNum });
      const walkDurationMins = Math.round(distNum * 12) || 5;
      const walkingEst = {
        category: 'walking',
        fare: 0,
        currency: 'KES',
        eta: walkDurationMins
      };
      const finalEsts = [...(ests || []), walkingEst];
      setEstimates(finalEsts);
      return finalEsts;
    } catch (e) {
      console.error('Error loading estimates', e);
      return [];
    }
  }, []);

  const getRouteDetails = useCallback(async (origin: {lat: number, lng: number}, dest: {lat: number, lng: number}) => {
    setIsOffRoad(false);
    if (!isLoaded || typeof google === 'undefined' || !google.maps) {
      // Loaders/fallback mock if Google Maps is not loaded yet (prevents DirectionsService TypeError)
      const distNum = getHaversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
      const distStr = `${distNum.toFixed(1)} km (direct)`;
      
      const driveMins = Math.max(1, Math.round(distNum * 2));
      const bikeMins = Math.max(1, Math.round(distNum * 3));
      const walkMins = Math.max(1, Math.round(distNum * 12));
      
      const results = {
        car: { dist: distStr, dur: `${driveMins} mins`, distance: distStr, duration: `${driveMins} mins` },
        bike: { dist: distStr, dur: `${bikeMins} mins`, distance: distStr, duration: `${bikeMins} mins` },
        foot: { dist: distStr, dur: `${walkMins} mins`, distance: distStr, duration: `${walkMins} mins` }
      };
      
      setDistance(distStr);
      setDuration(`${driveMins} mins`);
      setNavSteps([{
        instruction: 'Walk straight towards your destination',
        distance: distStr,
        duration: `${walkMins} mins`,
        lat: dest.lat,
        lng: dest.lng
      }]);
      setCurrentStepIndex(0);
      setMultiModal(results);
      return results.car;
    }

    const service = new google.maps.DirectionsService();
    const modes = [
      { mode: google.maps.TravelMode.DRIVING, key: 'car' },
      { mode: google.maps.TravelMode.BICYCLING, key: 'bike' },
      { mode: google.maps.TravelMode.WALKING, key: 'foot' }
    ];

    const results: any = {};
    for (const m of modes) {
      try {
        const result = await service.route({ origin, destination: dest, travelMode: m.mode });
        if (result.routes[0]?.legs[0]) {
          const leg = result.routes[0].legs[0];
          results[m.key] = { 
            dist: leg.distance?.text || '0', 
            dur: leg.duration?.text || '0',
            distance: leg.distance?.text || '0',
            duration: leg.duration?.text || '0'
          };
          const isActiveMode = (step === 'walking' && m.key === 'foot') || (step !== 'walking' && m.key === 'car');
          if (isActiveMode) {
            setDistance(leg.distance?.text ?? null);
            setDuration(leg.duration?.text ?? null);
          }
          if (m.key === 'foot' && leg.steps) {
            const cleanSteps = leg.steps.map((s: any) => ({
              instruction: s.instructions.replace(/<[^>]*>/g, ''), // Strip HTML tags
              distance: s.distance?.text || '',
              duration: s.duration?.text || '',
              lat: typeof s.end_location?.lat === 'function' ? s.end_location.lat() : s.end_location?.lat || dest.lat,
              lng: typeof s.end_location?.lng === 'function' ? s.end_location.lng() : s.end_location?.lng || dest.lng
            }));
            setNavSteps(cleanSteps);
            setCurrentStepIndex(0);
          }
        }
      } catch (err) { console.warn(`Route mode ${m.key} failed`, err); }
    }

    // If no mode could find a route (off-road fallback)
    if (!results.car) {
      setIsOffRoad(true);
      setNavMode('precision');
      const distNum = getHaversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
      const distStr = `${distNum.toFixed(1)} km (direct)`;
      
      const driveMins = Math.max(1, Math.round(distNum * 2));
      const bikeMins = Math.max(1, Math.round(distNum * 3));
      const walkMins = Math.max(1, Math.round(distNum * 12));
      
      results['car'] = { dist: distStr, dur: `${driveMins} mins`, distance: distStr, duration: `${driveMins} mins` };
      results['bike'] = { dist: distStr, dur: `${bikeMins} mins`, distance: distStr, duration: `${bikeMins} mins` };
      results['foot'] = { dist: distStr, dur: `${walkMins} mins`, distance: distStr, duration: `${walkMins} mins` };
      
      setDistance(distStr);
      setDuration(`${driveMins} mins`);

      setNavSteps([{
        instruction: 'Walk straight towards your destination',
        distance: distStr,
        duration: `${walkMins} mins`,
        lat: dest.lat,
        lng: dest.lng
      }]);
      setCurrentStepIndex(0);
    }

    setMultiModal(results);
    return results.car;
  }, [step, isLoaded]);

  const handleCenterPinChange = useCallback((lat: number, lng: number) => {
    if (!pickingOnMap) return;
    
    // Set immediate coordinates fallback so user can confirm instantly
    setTempCoords(prev => ({
      w3w: prev?.w3w && prev.lat === lat && prev.lng === lng ? prev.w3w : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng
    }));
    
    setIsResolving(true);

    if (resolveTimeoutRef.current) {
      clearTimeout(resolveTimeoutRef.current);
    }

    resolveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await convertTo3wa(lat, lng);
        setTempCoords(prev => {
          if (prev && prev.lat === lat && prev.lng === lng) {
            return { ...prev, w3w: res.what3words };
          }
          return prev;
        });
      } catch (err) {
        // Fallback is already set
      } finally {
        setIsResolving(false);
      }
    }, 400);
  }, [pickingOnMap]);



  const handleConfirmMapSelection = useCallback(async () => {
    if (!tempCoords || !pickingOnMap) return;
    setLoading(true);
    const { lat, lng, w3w } = tempCoords;
    try {
      setMapFocus({ lat, lng });
      if (pickingOnMap === 'pickup') {
        setPickup({ w3w, lat, lng });
        setIsPickupManual(true);
      } else {
        setDest({ w3w, lat, lng });
        if (pickup) {
          const details = await getRouteDetails(pickup, { lat, lng });
          if (details) {
            const distNum = parseFloat(details.distance?.split(' ')[0] || '0');
            const ests = await loadEstimates(distNum);
            setPrice(ests?.find((e: any) => e.category === 'economy')?.fare || 0);
          }
        }
        setStep('confirm');
      }
      setPickingOnMap(null);
      setTempCoords(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tempCoords, pickingOnMap, pickup, getRouteDetails, loadEstimates]);

  useEffect(() => {
    if (pickupInputRef.current) {
      pickupInputRef.current.value = pickup ? `///${pickup.w3w}` : '';
    }
  }, [pickup]);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    setUser(JSON.parse(u));
  }, [router]);

  useEffect(() => {
    const rideIdParam = searchParams.get('rideId');
    const modeParam = searchParams.get('mode');
    if (rideIdParam) {
      setRideId(rideIdParam);
      
      const pickupLat = parseFloat(searchParams.get('pickupLat') || '0');
      const pickupLng = parseFloat(searchParams.get('pickupLng') || '0');
      const pickupW3w = searchParams.get('pickupW3w') || '';
      if (pickupLat && pickupLng) {
        setPickup({ w3w: pickupW3w, lat: pickupLat, lng: pickupLng });
        setMapFocus({ lat: pickupLat, lng: pickupLng });
        setIsPickupManual(true);
      }

      const destLat = parseFloat(searchParams.get('destLat') || '0');
      const destLng = parseFloat(searchParams.get('destLng') || '0');
      const destW3w = searchParams.get('destW3w') || '';
      if (destLat && destLng) {
        setDest({ w3w: destW3w, lat: destLat, lng: destLng });
      }

      const categoryParam = searchParams.get('category');
      if (categoryParam) {
        setSelectedCategory(categoryParam);
      }

      const priceParam = parseFloat(searchParams.get('price') || '0');
      if (priceParam) {
        setPrice(priceParam);
      }

      const distanceParam = searchParams.get('distance');
      if (distanceParam) {
        setDistance(distanceParam);
      }

      const durationParam = searchParams.get('duration');
      if (durationParam) {
        setDuration(durationParam);
      }

      if (modeParam === 'walking') {
        setStep('walking');
      } else {
        // Automatically join the socket room for the ride
        const s = getSocket();
        s.emit('join', rideIdParam);
        setStep('waiting');
      }
    }
  }, [searchParams]);

  const handleW3WSuggestionSelect = useCallback(async (words: string) => {
    if (destInputRef.current) destInputRef.current.value = `///${words}`;
    setW3wSuggestions([]);
    setLoading(true);
    try {
      const { latitude, longitude } = await (await import('../../lib/api')).convertToCoordinates(words);
      setDest({ w3w: words, lat: latitude, lng: longitude });
      if (pickup) {
        const details = await getRouteDetails(pickup, { lat: latitude, lng: longitude });
        if (details) {
          const distNum = parseFloat(details.distance?.split(' ')[0] || '0');
          const ests = await loadEstimates(distNum);
          setPrice(ests?.find((e: any) => e.category === 'economy')?.fare || 0);
        }
      }
      setStep('confirm');
    } catch (err) {
      console.error("what3words coordinates resolution failed", err);
    } finally {
      setLoading(false);
    }
  }, [pickup, getRouteDetails, loadEstimates]);

  useEffect(() => {
    if (!position || isPickupManual || step === 'walking') return;
    const updateLivePickup = async () => {
      try {
        const res = await convertTo3wa(position.lat, position.lng);
        setPickup({ w3w: res.what3words, lat: position.lat, lng: position.lng });
      } catch (err) {
        setPickup({ w3w: `${position.lat.toFixed(4)},${position.lng.toFixed(4)}`, lat: position.lat, lng: position.lng });
      }
    };
    updateLivePickup();
  }, [position, isPickupManual, step]);

  useEffect(() => {
    const startLoc = pickup || position;
    if (step === 'walking' && startLoc && dest) {
      getRouteDetails(startLoc, dest);
    }
  }, [step, pickup?.lat, pickup?.lng, dest?.lat, dest?.lng, getRouteDetails]);

  // Step advancing effect
  useEffect(() => {
    if (step === 'walking' && position && navSteps.length > 0 && currentStepIndex < navSteps.length) {
      const nextStep = navSteps[currentStepIndex];
      const distToStepEnd = getHaversineDistance(position.lat, position.lng, nextStep.lat, nextStep.lng) * 1000; // In meters
      if (distToStepEnd < 20) {
        if (currentStepIndex < navSteps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        }
      }
    }
  }, [position, navSteps, currentStepIndex, step]);

  // Arrival detection effect
  useEffect(() => {
    if (step === 'walking' && position && dest) {
      const distToDest = getHaversineDistance(position.lat, position.lng, dest.lat, dest.lng) * 1000; // In meters
      if (distToDest < 15 && !showArrivedModal) {
        setShowArrivedModal(true);
      }
    }
  }, [position, dest, step, showArrivedModal]);

  useEffect(() => {
    if (step === 'confirm' && pickup && dest) {
      const updateRouteAndPrice = async () => {
        const details = await getRouteDetails(pickup, dest);
        if (details) {
          const distNum = parseFloat(details.distance?.split(' ')[0] || '0');
          const ests = await loadEstimates(distNum);
          setPrice(ests?.find((e: any) => e.category === selectedCategory)?.fare || ests?.find((e: any) => e.category === 'economy')?.fare || 0);
        }
      };
      updateRouteAndPrice();
    }
  }, [step, pickup?.lat, pickup?.lng, dest?.lat, dest?.lng, selectedCategory, getRouteDetails, loadEstimates]);



  const handlePickupSelect = useCallback(async () => {
    if (!startAutocompleteRef.current) return;
    const place = startAutocompleteRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setLoading(true);
    try {
      const res = await convertTo3wa(lat, lng);
      setPickup({ w3w: res.what3words, lat, lng });
      setIsPickupManual(true);
    } catch (err) { 
      setPickup({ w3w: `${lat.toFixed(4)},${lng.toFixed(4)}`, lat, lng });
      setIsPickupManual(true);
    } finally { setLoading(false); }
  }, []);

  const handleDestSelect = useCallback(async () => {
    if (!destAutocompleteRef.current) return;
    const place = destAutocompleteRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setLoading(true);
    try {
      const res = await convertTo3wa(lat, lng);
      setDest({ w3w: res.what3words, lat, lng });
      if (pickup) {
        const details = await getRouteDetails(pickup, { lat, lng });
        if (details) {
          const distNum = parseFloat(details.distance?.split(' ')[0] || '0');
          const ests = await loadEstimates(distNum);
          setPrice(ests?.find((e: any) => e.category === 'economy')?.fare || 0);
          setStep('confirm');
        }
      }
    } catch (err) { 
      setDest({ w3w: `${lat.toFixed(4)},${lng.toFixed(4)}`, lat, lng });
      setStep('confirm');
    } finally { setLoading(false); }
  }, [pickup, getRouteDetails, loadEstimates]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!pickingOnMap) return;
    setLoading(true);
    try {
      const res = await convertTo3wa(lat, lng);
      setMapFocus({ lat, lng });
      if (pickingOnMap === 'pickup') {
        setPickup({ w3w: res.what3words, lat, lng });
        setIsPickupManual(true);
      } else {
        setDest({ w3w: res.what3words, lat, lng });
        if (pickup) {
          const details = await getRouteDetails(pickup, { lat, lng });
          if (details) {
            const distNum = parseFloat(details.distance?.split(' ')[0] || '0');
            const ests = await loadEstimates(distNum);
            setPrice(ests?.find((e: any) => e.category === 'economy')?.fare || 0);
          }
        }
        setStep('confirm');
      }
      setPickingOnMap(null);
    } catch (err) { 
      const label = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      setMapFocus({ lat, lng });
      if (pickingOnMap === 'pickup') {
        setPickup({ w3w: label, lat, lng });
        setIsPickupManual(true);
      } else {
        setDest({ w3w: label, lat, lng });
        setStep('confirm');
      }
      setPickingOnMap(null);
    } finally { setLoading(false); }
  }, [pickingOnMap, pickup, getRouteDetails, loadEstimates]);

  const confirmRide = async () => {
    if (!pickup || !dest || !user) return;
    if (selectedCategory === 'walking') {
      const distNum = parseFloat(distance?.split(' ')[0] || '0');
      const walkDurationMins = Math.round(distNum * 12) || 5;
      setDuration(`${walkDurationMins} min`);
      setStep('walking');
      return;
    }
    setLoading(true);
    try {
      const r = await requestRide({
        pickup: { lat: pickup.lat, lng: pickup.lng, words: pickup.w3w },
        destination: { lat: dest.lat, lng: dest.lng, words: dest.w3w },
        category: selectedCategory,
        distance: parseFloat(distance?.split(' ')[0] || '0'),
        duration: parseFloat(duration?.split(' ')[0] || '0')
      });
      setRideId(r.id);
      const s = getSocket();
      s.emit('join', r.id);
      s.emit('broadcast-request', {
        id: r.id,
        shareCode: r.id,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destinationWhat3words: dest.w3w,
        rider: { fullName: user.fullName },
        status: 'requested',
        category: selectedCategory,
        fare: price
      });
      setStep('waiting');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'waiting' && step !== 'active') return;
    const s = getSocket();
    const onAccepted = (data: any) => {
      setDriver(data);
      setAcceptedNotif(true);
      setStep('active');
      setTimeout(() => setAcceptedNotif(false), 5000);
    };
    const onDriverLoc = (data: { code: string; viewerId: string; lat: number; lng: number; heading?: number }) => {
      setDriver((prev: any) => {
        if (!prev) return null;
        if (data.viewerId !== prev.helperId) return prev;
        return { ...prev, lat: data.lat, lng: data.lng, heading: data.heading };
      });
    };
    s.on('request-accepted', onAccepted);
    s.on('viewer-location', onDriverLoc);
    return () => { 
      s.off('request-accepted', onAccepted); 
      s.off('viewer-location', onDriverLoc);
    };
  }, [step]);

  const markers: MarkerData[] = [
    ...(position ? [{ lat: position.lat, lng: position.lng, type: 'me' as const, heading: position.heading, accuracy: position.accuracy }] : []),
    ...(pickup ? [{ lat: pickup.lat, lng: pickup.lng, type: 'request' as const, label: 'Pickup' }] : []),
    ...(dest ? [{ lat: dest.lat, lng: dest.lng, type: 'tracked' as const, label: 'Destination' }] : []),
    ...(driver?.lat ? [{ lat: driver.lat, lng: driver.lng, type: 'car' as const, heading: driver.heading, label: driver.driverName }] : []),
  ];

  const center = mapFocus ?? pickup ?? position ?? { lat: -1.2921, lng: 36.8219 };

  const startLoc = pickup || position;
  const distToDest = (startLoc && dest) ? getHaversineDistance(startLoc.lat, startLoc.lng, dest.lat, dest.lng) * 1000 : null;
  const isPrecisionActive = navMode === 'precision' || isOffRoad || (navMode === 'hybrid' && distToDest !== null && distToDest <= 150);
  const bearingAngle = (startLoc && dest) ? bearing(startLoc, dest) : 0;
  const cardinalDirection = getCardinalDirection(bearingAngle);

  const routeConfidence = useMemo(() => {
    if (isOffRoad || navMode === 'precision') return 'low';
    if (navMode === 'hybrid') return 'medium';
    return 'high';
  }, [isOffRoad, navMode]);

  const microGuidance = useMemo(() => {
    if (distToDest === null || !cardinalDirection) return 'Walk straight towards your destination';
    if (distToDest <= 15) {
      return `🎯 Target Acquired! Lock into the 3-meter square ///${dest?.w3w}`;
    }
    if (distToDest <= 50) {
      return `🚶‍♂️ Approaching target. Walk ${Math.round(distToDest)}m ${cardinalDirection} toward the destination square.`;
    }
    return `Walk ${Math.round(distToDest)}m ${cardinalDirection} directly to coordinate`;
  }, [distToDest, cardinalDirection, dest?.w3w]);

  // Auto-pan to position when it's acquired initially
  useEffect(() => {
    if (position && !mapFocus) {
      setMapFocus({ lat: position.lat, lng: position.lng });
      mapRef.current?.panTo(position.lat, position.lng);
    }
  }, [position, mapFocus]);

  return (
    <div className="h-full w-full bg-white font-outfit relative overflow-hidden">
      {/* Immersive Map Background */}
      <div className="absolute inset-0 z-0">
        <MapBase 
          forwardedRef={mapRef}
          center={center} 
          zoom={17.5} 
          markers={markers} 
          routeFrom={
            step === 'walking' && position
              ? { lat: position.lat, lng: position.lng }   // live bearing from current GPS
              : pickup
                ? { lat: pickup.lat, lng: pickup.lng }
                : position
                  ? { lat: position.lat, lng: position.lng }
                  : undefined
          }
          routeTo={dest ? { lat: dest.lat, lng: dest.lng } : undefined}
          className="w-full h-full" 
          isSelectingPickup={!!pickingOnMap}
          onCenterPinChange={handleCenterPinChange}
          travelMode={step === 'walking' ? 'WALKING' : 'DRIVING'}
          zoomState={step === 'walking' ? 'navigation' : undefined}
          forceDirect={step === 'walking' || isPrecisionActive}
        />

        {/* Premium Floating Controls */}
        {step === 'confirm' ? (
          <div className="absolute top-12 left-4 right-4 z-40 bg-white rounded-[24px] shadow-premium flex flex-col pointer-events-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-gray-50/50">
              <button onClick={() => setStep('select')} className="active:scale-95"><CloseOutlined className="text-xl" /></button>
              <div className="flex-1 flex justify-center items-center text-sm font-black truncate px-4">
                <span className="text-green-700 truncate max-w-[100px]">{pickup?.w3w?.split('.')[0] || 'Pickup'}</span>
                <ArrowRightOutlined className="mx-2 text-gray-400 text-xs" />
                <span className="text-black truncate max-w-[100px]">{dest?.w3w?.split('.')[0] || 'Dropoff'}</span>
              </div>
              <button className="active:scale-95"><PlusOutlined className="text-xl" /></button>
            </div>
            <div className="flex items-center justify-between px-6 py-2.5 bg-black text-white text-[11px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><ClockCircleOutlined /> {duration || 'ETA'}</span>
              <span className="flex items-center gap-1.5"><EnvironmentFilled /> {distance || 'Dist'}</span>
              <span className="text-yellow-400 text-sm">KES {price}</span>
            </div>
          </div>
        ) : (
          <div className="absolute top-12 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
            <button 
              onClick={() => router.back()} 
              className="pointer-events-auto w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-premium active:scale-95 transition-transform border border-gray-100"
            >
              <ArrowLeftOutlined className="text-xl text-black" />
            </button>
          </div>
        )}

        {acceptedNotif && driver && (
          <div className="absolute top-24 left-6 right-6 z-[100] animate-bounce-in">
            <div className="bg-green-600 p-4 rounded-2xl shadow-premium flex items-center gap-4 border border-white/20">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl">
                <CheckOutlined />
              </div>
              <div>
                <p className="text-xs font-black text-white/70 uppercase">Driver Accepted!</p>
                <p className="text-sm font-black text-white">{driver.driverName} is on the way</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Floating Circular Map Controls */}
      <div className={`absolute right-6 z-20 flex flex-col gap-3 transition-all duration-300 pointer-events-none ${
        step === 'walking' ? 'bottom-[120px]' : 'bottom-[340px]'
      }`}>
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

        {/* GPS Location Recenter Button */}
        <button 
          onClick={() => {
            if (position) {
              setMapFocus({ lat: position.lat, lng: position.lng });
              mapRef.current?.panTo(position.lat, position.lng);
              setIsPickupManual(false);
            }
          }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-premium active:scale-90 transition-all border border-gray-50 hover:bg-gray-50 pointer-events-auto"
        >
          <AimOutlined className="text-lg text-black" />
        </button>
      </div>

      {/* Premium Coordination Sheet / Floating Navigation */}
      {step === 'walking' ? (
        <div className="absolute bottom-8 left-6 right-6 z-50 animate-slide-up-spring flex flex-col gap-3">
          {/* Start to Finish Route Tag */}
          <div className="bg-black/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-wider flex items-center justify-between shadow-lg self-start">
            <span className="truncate max-w-[120px] text-green-400">///{pickup?.w3w?.split('.')[0] || 'Start'}</span>
            <ArrowRightOutlined className="text-gray-500 mx-2 text-[8px]" />
            <span className="truncate max-w-[120px] text-white">///{dest?.w3w?.split('.')[0] || 'Finish'}</span>
          </div>

          {/* Floating Premium Navigation Panel */}
          <div className="bg-black/95 backdrop-blur-md rounded-[28px] border border-white/15 p-5 shadow-2xl flex flex-col gap-3.5">
            {/* 1. Dynamic Mode Switcher Tabs */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
              <button 
                disabled={isOffRoad}
                onClick={() => setNavMode('smart')}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
                  isOffRoad ? 'opacity-35 cursor-not-allowed text-gray-500' :
                  navMode === 'smart' ? 'bg-[#FFD600] text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Smart (Road)
              </button>
              <button 
                disabled={isOffRoad}
                onClick={() => setNavMode('hybrid')}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
                  isOffRoad ? 'opacity-35 cursor-not-allowed text-gray-500' :
                  navMode === 'hybrid' ? 'bg-[#FFD600] text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Hybrid
              </button>
              <button 
                onClick={() => setNavMode('precision')}
                className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
                  navMode === 'precision' ? 'bg-[#FFD600] text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                Precision
              </button>
            </div>

            {/* 2. Off-Road Fallback Warning Banner & Route Confidence Badges */}
            <div className="flex flex-col gap-2">
              {routeConfidence === 'high' && (
                <span className="text-[8px] font-black uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 self-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  🟢 High Confidence (Street Mapped)
                </span>
              )}
              {routeConfidence === 'medium' && (
                <span className="text-[8px] font-black uppercase tracking-wider text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 self-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  🟡 Medium Confidence (Hybrid Path)
                </span>
              )}
              {routeConfidence === 'low' && (
                <span className="text-[8px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 self-start animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  🔴 Precision Guidance Active (Off-Road Focus)
                </span>
              )}

              {isOffRoad && (
                <div className="bg-yellow-500/20 border border-yellow-500/30 px-3.5 py-2.5 rounded-xl text-[9px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 animate-bounce-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  ⚠️ Exact destination found. Using precision guidance mode.
                </div>
              )}
            </div>

            {/* 3. Conditional Mode Guidance View */}
            {isPrecisionActive ? (
              /* Precision Mode Guidance (Coordinate-first) */
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Coordinating Compass Dial */}
                  <div className="w-12 h-12 rounded-full bg-black border-4 border-white/10 flex items-center justify-center relative shadow-lg flex-shrink-0">
                    <span className="absolute top-0.5 text-[7px] font-black text-gray-400">N</span>
                    <AimOutlined 
                      className="text-[#FFD600] text-lg transition-transform duration-500"
                      style={{ transform: `rotate(${bearingAngle}deg)` }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-yellow-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                      🎯 Precision Guidance Mode Active
                    </span>
                    <h3 className="text-sm font-black text-white leading-tight mt-1">
                      {microGuidance}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">
                      Direct geodesic vector to ///{dest?.w3w}
                    </p>
                  </div>
                </div>

                {/* dynamic Coordinating Target Lock progress bar */}
                {distToDest !== null && distToDest <= 150 && (
                  <div className="flex flex-col gap-1.5 bg-white/5 border border-white/10 rounded-xl p-3 shadow-inner">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/70">
                      <span>Coordinating Target Lock</span>
                      <span className={`${distToDest <= 15 ? 'text-green-400 animate-pulse' : 'text-[#FFD600]'}`}>
                        {distToDest <= 15 ? '⚡ ACQUIRED (100%)' : distToDest <= 50 ? '🎯 LOCKING (80%)' : '📡 LOCATING (50%)'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 border border-white/5 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          distToDest <= 15 ? 'bg-green-500 animate-pulse' : 'bg-[#FFD600]'
                        }`}
                        style={{ width: `${distToDest <= 15 ? 100 : distToDest <= 50 ? 80 : 50}%` }}
                      />
                    </div>
                    <span className="text-[8.5px] font-bold text-gray-500 text-right uppercase tracking-wider mt-0.5">
                      Accuracy Radius: {distToDest <= 15 ? '3-Meter Square Lock' : `${Math.round(distToDest / 2)}m tolerance`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Smart Road Route Guidance */
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFD600] flex items-center justify-center text-xl flex-shrink-0 animate-pulse">
                    🚶‍♂️
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                      {navMode === 'hybrid' ? 'Hybrid Mode (Road Path)' : 'Smart Route Mode (Road Path)'}
                    </span>
                    {navSteps.length > 0 && currentStepIndex < navSteps.length ? (
                      <h3 className="text-sm font-black text-white leading-tight mt-1">
                        {navSteps[currentStepIndex].instruction}
                      </h3>
                    ) : (
                      <h3 className="text-sm font-black text-white leading-tight mt-1">
                        Follow the highlighted path on the map
                      </h3>
                    )}
                    <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">
                      {distance || '1.0 km'} remaining (ETA {duration || '12 min'}) · to ///{dest?.w3w?.split('.')[0] || 'destination'}
                    </p>
                  </div>
                </div>

                {/* dynamic Coordinating Target Lock progress bar in hybrid road range */}
                {navMode === 'hybrid' && distToDest !== null && distToDest <= 150 && (
                  <div className="flex flex-col gap-1.5 bg-white/5 border border-white/10 rounded-xl p-3 shadow-inner">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/70">
                      <span>Coordinating Target Lock</span>
                      <span className="text-[#FFD600]">📡 LOCATING (50%)</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 border border-white/5 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full rounded-full bg-[#FFD600] transition-all duration-500"
                        style={{ width: '50%' }}
                      />
                    </div>
                    <span className="text-[8.5px] font-bold text-gray-500 text-right uppercase tracking-wider mt-0.5">
                      Accuracy Radius: {Math.round(distToDest / 2)}m tolerance
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Quick Step Buttons and End button */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              {!isPrecisionActive && navSteps.length > 1 && (
                <div className="flex gap-2">
                  <button 
                    disabled={currentStepIndex === 0}
                    onClick={() => setCurrentStepIndex(prev => prev - 1)}
                    className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    Prev
                  </button>
                  {currentStepIndex >= navSteps.length - 1 ? (
                    <button 
                      onClick={() => setShowArrivedModal(true)}
                      className="h-9 px-3.5 rounded-xl bg-[#FFD600] active:scale-95 text-black font-black text-[10px] uppercase tracking-wider transition-all animate-pulse"
                    >
                      Finish
                    </button>
                  ) : (
                    <button 
                      onClick={() => setCurrentStepIndex(prev => prev + 1)}
                      className="h-9 px-3.5 rounded-xl bg-[#FFD600] active:scale-95 text-black font-black text-[10px] uppercase tracking-wider transition-all"
                    >
                      Next ({currentStepIndex + 1}/{navSteps.length})
                    </button>
                  )}
                </div>
              )}
              <button 
                onClick={() => {
                  setStep('select');
                  setPickup(null);
                  setDest(null);
                  router.push('/home');
                }}
                className="h-9 px-5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-black text-[10px] tracking-wider uppercase transition-all shadow-lg ml-auto"
              >
                End
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[40px] shadow-sheet z-50 flex flex-col animate-slide-up-spring">
          <div className="sheet-handle" />
          
          <div className="px-6 pb-28 pt-2">
          {/* STEP 1: SELECT */}
          {step === 'select' && !pickingOnMap && (
            <div className="animate-fade-in">
            <h2 className="text-2xl font-black text-black tracking-tighter mb-6">Where to?</h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 input-container bg-gray-50 !border-gray-100 h-16">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                  {isLoaded && (
                    <Autocomplete onLoad={auto => startAutocompleteRef.current = auto} onPlaceChanged={handlePickupSelect} className="flex-1">
                      <input 
                        ref={pickupInputRef}
                        className="w-full bg-transparent border-none outline-none text-sm font-black text-black placeholder:text-gray-300" 
                        placeholder="Current location..." 
                      />
                    </Autocomplete>
                  )}
                </div>
                <button 
                  onClick={async () => {
                    if (position) {
                      setLoading(true);
                      try {
                        const res = await convertTo3wa(position.lat, position.lng);
                        setPickup({ w3w: res.what3words, lat: position.lat, lng: position.lng });
                      } catch (err) {
                        setPickup({ w3w: `${position.lat.toFixed(4)},${position.lng.toFixed(4)}`, lat: position.lat, lng: position.lng });
                      } finally {
                        setLoading(false);
                      }
                      setMapFocus({ lat: position.lat, lng: position.lng });
                      mapRef.current?.panTo(position.lat, position.lng);
                      setIsPickupManual(false);
                    }
                  }} 
                  className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
                >
                  <AimOutlined className="text-xl text-green-500" />
                </button>
              </div>
              <div className="flex gap-3 relative">
                <div className="flex-1 input-container h-16 border-2 border-black relative">
                  <div className="w-2 h-2 rounded-sm bg-black mr-1" />
                  {isLoaded && (
                    <>
                      <Autocomplete onLoad={auto => destAutocompleteRef.current = auto} onPlaceChanged={handleDestSelect} className="flex-1 w-full flex">
                        <input 
                          ref={destInputRef}
                          autoFocus 
                          className="w-full bg-transparent border-none outline-none text-base font-black text-black placeholder:text-gray-300 flex-1" 
                          placeholder="Search destination..." 
                          onChange={async (e) => {
                            const val = e.target.value;
                            setDestIn(val);
                            
                            // Custom What3Words autosuggest dropdown integration
                            if (val.includes('.') || val.startsWith('///')) {
                              try {
                                const res = await (await import('../../lib/api')).autosuggest(val, position || undefined);
                                setW3wSuggestions(res.suggestions || []);
                              } catch {
                                setW3wSuggestions([]);
                              }
                            } else {
                              setW3wSuggestions([]);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setW3wSuggestions([]), 200);
                          }}
                        />
                      </Autocomplete>

                      {/* Premium dropdown overlay for What3Words suggestions */}
                      {w3wSuggestions.length > 0 && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-premium border border-gray-100 z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto no-scroll">
                          <div className="px-5 py-2.5 bg-red-50/30 border-b border-gray-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">What3Words Addresses</span>
                          </div>
                          {w3wSuggestions.map((s: any, i: number) => (
                            <button 
                              key={`ride-w3w-${i}`}
                              type="button"
                              onClick={() => handleW3WSuggestionSelect(s.words)}
                              className="w-full px-5 py-3.5 flex items-center gap-4 text-left active:bg-gray-50 border-b border-gray-100 last:border-none transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                <EnvironmentOutlined className="text-red-500 text-sm" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-red-600 leading-none mb-1">///{s.words}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.nearestPlace}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => setPickingOnMap('dest')} className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"><AimOutlined className="text-xl text-black" /></button>
              </div>
            </div>
          </div>
          )}

          {/* MAP PICKER CONFIRMATION OVERLAY */}
          {pickingOnMap && (
            <div className="animate-fade-in space-y-4">
              <div className="glass-premium p-5 rounded-[24px] border border-gray-100 flex items-center justify-between shadow-premium transition-all duration-300">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    pickingOnMap === 'pickup' ? 'bg-green-50' : 'bg-yellow-50'
                  }`}>
                    <EnvironmentOutlined className={`text-lg ${
                      pickingOnMap === 'pickup' ? 'text-green-500' : 'text-[#FFD600]'
                    } animate-pulse`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {pickingOnMap === 'pickup' ? 'Select Pickup Spot' : 'Select Destination Spot'}
                    </p>
                    <h3 className={`text-base font-black truncate leading-none mt-1 ${
                      pickingOnMap === 'pickup' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {tempCoords ? `///${tempCoords.w3w}` : 'Locating precise spot...'}
                      {isResolving && <span className="ml-2 text-xs font-normal text-gray-400 animate-pulse">(updating...)</span>}
                    </h3>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setPickingOnMap(null);
                    setTempCoords(null);
                  }}
                  className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-400 font-black text-sm active:scale-95 transition-transform"
                >
                  CANCEL
                </button>
                <button 
                  disabled={!tempCoords}
                  onClick={handleConfirmMapSelection}
                  className="flex-[2] py-4 rounded-2xl bg-black text-white font-black text-sm shadow-premium active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <CheckOutlined /> CONFIRM LOCATION
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIRM */}
          {step === 'confirm' && (
            <div className="animate-fade-in flex flex-col h-full">
              {/* Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto no-scroll pb-2">
                <button className="px-5 py-2.5 bg-white border-[1.5px] border-[#32B259] text-[#32B259] rounded-full font-bold text-sm whitespace-nowrap shadow-sm">Recommended</button>
                <button className="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full font-bold text-sm whitespace-nowrap flex items-center gap-1"><ClockCircleOutlined /> Faster</button>
                <button className="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full font-bold text-sm whitespace-nowrap flex items-center gap-1"><DollarOutlined /> Cheaper</button>
              </div>

              {/* Vehicle List */}
              <div className="space-y-3 overflow-y-auto max-h-[35vh] no-scroll mb-4 flex-1">
                {estimates.map((est) => {
                  const isSelected = selectedCategory === est.category;
                  return (
                    <button key={est.category} onClick={() => { setSelectedCategory(est.category); setPrice(est.fare); }} className={`w-full flex items-center gap-4 p-4 rounded-xl text-left border-[1.5px] transition-colors ${isSelected ? 'border-[#32B259] bg-white' : 'border-transparent bg-transparent'}`}>
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-3xl relative flex-shrink-0">
                        {est.category === 'bike' ? '🏍️' : est.category === 'walking' ? '🚶‍♂️' : '🚗'}
                        {est.category === 'bike' && <div className="absolute -bottom-1 -left-1 bg-[#32B259] rounded-full p-1 border-2 border-white"><ThunderboltFilled className="text-white text-[10px]" /></div>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <h3 className="text-[17px] font-black text-black capitalize">{est.category}</h3>
                          {isSelected && <span className="text-gray-400 text-[10px]">︽</span>}
                        </div>
                        <p className="text-sm font-bold text-gray-500 mt-0.5">{est.eta} min <UserOutlined className="mx-1 text-xs" /> {est.category === 'bike' ? 1 : 4}</p>
                        {est.category === 'bike' && <p className="text-[10px] font-bold text-[#32B259] bg-green-50 w-max px-1.5 py-0.5 rounded uppercase tracking-wider mt-1">Faster</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[17px] font-black text-black">KES {est.fare}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Payment and Confirm */}
              <div className="bg-white pt-2 border-t border-gray-100 shrink-0">
                <div className="flex items-center gap-3 mb-4 px-2 cursor-pointer">
                  <div className="flex bg-gray-100 rounded-full p-1">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"><UserOutlined className="text-gray-600" /></div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400"><ShoppingOutlined /></div>
                  </div>
                  <span className="font-bold text-[17px] flex-1 text-black">Cash</span>
                  <DownOutlined className="text-gray-400 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmRide} disabled={loading} className="flex-1 h-14 bg-[#32B259] text-white rounded-full font-black text-lg active:scale-95 transition-transform flex items-center justify-center">
                    {loading ? <LoadingOutlined /> : `Select ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`}
                  </button>
                  <button className="w-14 h-14 bg-[#32B259] text-white rounded-full flex items-center justify-center text-xl active:scale-95"><CalendarOutlined /></button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: WAITING */}
          {step === 'waiting' && (
            <div className="animate-fade-in">
            <div className="py-12 text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 bg-black rounded-[32px] flex items-center justify-center z-10 shadow-premium"><CarOutlined className="text-4xl text-white" /></div>
                <div className="absolute inset-0 bg-black rounded-[32px] animate-ping opacity-20" />
              </div>
              <h2 className="text-2xl font-black text-black tracking-tighter">Finding Driver</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Connecting to precision radar...</p>
              <button onClick={async () => { if (rideId) await cancelRide(rideId); setStep('confirm'); }} className="mt-12 px-8 py-4 bg-red-50 text-red-500 rounded-2xl border-2 border-red-100 font-black text-xs tracking-widest uppercase active:scale-95 transition-transform">Cancel Journey</button>
            </div>
          </div>
          )}

          {/* STEP 4: ACTIVE */}
          {step === 'active' && driver && (
            <div className="animate-fade-in">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-6 bg-black rounded-[32px] shadow-premium">
                  <div className="w-16 h-16 rounded-2xl bg-yellow-400 flex items-center justify-center font-black text-2xl text-black">{driver.driverName[0]}</div>
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/70">Driver arriving</span>
                    <h3 className="text-lg font-black text-white leading-tight">{driver.driverName}</h3>
                    <p className="text-xs font-bold text-gray-500">{driver.vehicleModel} · {driver.licensePlate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button className="btn bg-gray-50 text-black py-4 font-black text-sm rounded-2xl border border-gray-100">Message</button>
                  <button className="btn bg-gray-50 text-black py-4 font-black text-sm rounded-2xl border border-gray-100">Call Driver</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {showArrivedModal && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-2xl max-w-sm w-full text-center space-y-6 animate-slide-up-spring">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-4xl mx-auto shadow-inner border border-green-100/50 animate-bounce">
              🎉
            </div>
            <div>
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none">Destination Reached</p>
              <h2 className="text-2xl font-black text-black mt-2 leading-none">You Have Arrived!</h2>
              <p className="text-xs font-bold text-gray-400 mt-2">
                You have successfully completed your journey to ///{dest?.w3w?.split('.')[0] || 'destination'}.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button 
                onClick={() => {
                  setShowArrivedModal(false);
                  setStep('select');
                  setPickup(null);
                  setDest(null);
                  router.push('/home');
                }}
                className="w-full py-4 rounded-2xl bg-black hover:bg-black/90 active:scale-95 text-white font-black text-sm transition-all shadow-lg"
              >
                CLOSE DIRECTIONS
              </button>
              <button 
                onClick={() => setShowArrivedModal(false)}
                className="w-full py-3 rounded-2xl bg-gray-50 hover:bg-gray-100 active:scale-95 text-gray-400 font-bold text-xs tracking-wider uppercase transition-all"
              >
                KEEP MAP OPEN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RidePage() {
  return (
    <Suspense fallback={
      <div className="h-full w-full bg-white flex items-center justify-center font-outfit">
        <div className="text-center">
          <LoadingOutlined className="text-3xl text-black mb-4 animate-spin" />
          <p className="text-sm font-bold text-gray-400">Loading Precision Hub...</p>
        </div>
      </div>
    }>
      <RidePageContent />
    </Suspense>
  );
}
