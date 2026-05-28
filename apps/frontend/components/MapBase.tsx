'use client';
import { GoogleMap, Circle, MarkerF } from '@react-google-maps/api';
import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { getGridSection } from '../lib/api';

const LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',            stylers: [{ color: '#f1f3f4' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'on' }, { opacity: 0.6 }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f1f3f4' }] },
  { featureType: 'road',                elementType: 'geometry',           stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                elementType: 'geometry.stroke',    stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway',        elementType: 'geometry',           stylers: [{ color: '#abb8c3' }] },
  { featureType: 'road.highway',        elementType: 'geometry.stroke',    stylers: [{ color: '#919ea8' }] },
  { featureType: 'road.arterial',       elementType: 'geometry',           stylers: [{ color: '#abb8c3' }] },
  { featureType: 'road.local',          elementType: 'geometry',           stylers: [{ color: '#ffffff' }] },
  { featureType: 'water',               elementType: 'geometry',           stylers: [{ color: '#c9d2d4' }] },
  { featureType: 'poi.park',            elementType: 'geometry',           stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'landscape.man_made',  elementType: 'geometry',           stylers: [{ color: '#d5dadd' }, { visibility: 'on' }] },
  { featureType: 'landscape.man_made',  elementType: 'geometry.stroke',    stylers: [{ color: '#b9c0c7' }, { visibility: 'on' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'on' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3c3c3c' }, { fontWeight: 'bold' }] },
];

export interface MarkerData {
  lat: number; lng: number;
  type: 'me' | 'tracked' | 'request' | 'car' | 'place';
  label?: string;
  accuracy?: number;
  heading?: number;
  category?: string;
  placeId?: string;
  words?: string;
  onClick?: () => void;
}

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  routeFrom?: { lat: number; lng: number };
  routeTo?: { lat: number; lng: number };
  className?: string;
  onClick?: (lat: number, lng: number) => void;
  isSelectingPickup?: boolean;
  onCenterPinChange?: (lat: number, lng: number) => void;
  onDraggingStateChange?: (dragging: boolean) => void;
  followMode?: boolean;
  onFollowModeChange?: (active: boolean) => void;
  zoomState?: 'city' | 'pickup' | 'tracking' | 'navigation';
  travelMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  forceDirect?: boolean;
}

export interface MapHandle {
  panTo: (lat: number, lng: number) => void;
  setZoom: (zoom: number) => void;
  getMap: () => google.maps.Map | null;
}

function imgIcon(url: string, size: number): google.maps.Icon {
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

const MapBase = forwardRef<MapHandle, Props>(({ 
  center, 
  zoom = 15, 
  markers = [], 
  routeFrom, 
  routeTo, 
  className, 
  onClick,
  isSelectingPickup = false,
  onCenterPinChange,
  onDraggingStateChange,
  followMode = false,
  onFollowModeChange,
  zoomState,
  travelMode,
  forceDirect = false
}, ref) => {
  const { isLoaded } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const gridFeatures = useRef<google.maps.Data.Feature[]>([]);
  const gridTimeoutRef = useRef<any>(null);

  const distToDest = useMemo(() => {
    if (!routeFrom || !routeTo) return null;
    const R = 6371; // Earth radius in km
    const dLat = (routeTo.lat - routeFrom.lat) * Math.PI / 180;
    const dLon = (routeTo.lng - routeFrom.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(routeFrom.lat * Math.PI / 180) * Math.cos(routeTo.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance in meters
  }, [routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  const memoizedRouteFrom = useMemo(() => {
    if (!routeFrom) return undefined;
    return { lat: routeFrom.lat, lng: routeFrom.lng };
  }, [routeFrom?.lat, routeFrom?.lng]);

  const memoizedRouteTo = useMemo(() => {
    if (!routeTo) return undefined;
    return { lat: routeTo.lat, lng: routeTo.lng };
  }, [routeTo?.lat, routeTo?.lng]);

  const memoizedCenter = useMemo(() => {
    return { lat: center.lat, lng: center.lng };
  }, [center?.lat, center?.lng]);

  // Fixed pin animation dragging state
  const [isDragging, setIsDragging] = useState(false);

  // User interaction lock states & refs to prevent programmatic updates from resetting manual zooms/pans
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [currentMapCenter, setCurrentMapCenter] = useState<{ lat: number; lng: number }>(center);
  const [currentMapZoom, setCurrentMapZoom] = useState<number>(zoom);

  const isProgrammaticRef = useRef(false);
  const lastZoomStateRef = useRef<string | undefined>(undefined);
  const lastFollowModeRef = useRef<boolean>(false);

  // Synchronize center and zoom props if user has not interacted
  useEffect(() => {
    if (!userHasInteracted) {
      setCurrentMapCenter({ lat: center.lat, lng: center.lng });
    }
  }, [center.lat, center.lng, userHasInteracted]);

  useEffect(() => {
    if (!userHasInteracted) {
      setCurrentMapZoom(zoom);
    }
  }, [zoom, userHasInteracted]);

  // Reset interaction lock on prop changes/transitions
  useEffect(() => {
    if (zoomState !== lastZoomStateRef.current || followMode !== lastFollowModeRef.current) {
      lastZoomStateRef.current = zoomState;
      lastFollowModeRef.current = followMode;
      setUserHasInteracted(false);
    }
  }, [zoomState, followMode]);

  // Linear Interpolation (LERP) for driver movement
  const [liveCars, setLiveCars] = useState<MarkerData[]>([]);
  const targetCarsRef = useRef<MarkerData[]>([]);
  const interpolationLoopRef = useRef<number | null>(null);

  useEffect(() => {
    const cars = markers.filter(m => m.type === 'car');
    targetCarsRef.current = cars;
    if (liveCars.length === 0 && cars.length > 0) {
      setLiveCars(cars);
    }
  }, [markers]);

  useEffect(() => {
    const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

    const animateDriverMovement = () => {
      setLiveCars(prevCars => {
        if (targetCarsRef.current.length === 0) {
          return prevCars.length === 0 ? prevCars : [];
        }

        let changed = false;
        const nextCars = targetCarsRef.current.map(target => {
          const prev = prevCars.find(p => p.label === target.label) || 
                       prevCars.find(p => Math.abs(p.lat - target.lat) < 0.1 && Math.abs(p.lng - target.lng) < 0.1);
          if (!prev) {
            changed = true;
            return target;
          }

          const lerpFactor = 0.08; // High-frequency smoothing factor
          const lat = lerp(prev.lat, target.lat, lerpFactor);
          const lng = lerp(prev.lng, target.lng, lerpFactor);

          // Angle LERP wrapping around 360 degrees
          let heading = prev.heading ?? 0;
          const targetHeading = target.heading ?? 0;
          let diff = targetHeading - heading;
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;
          heading = (heading + diff * lerpFactor + 360) % 360;

          // Check if vehicle has moved significantly
          const latDiff = Math.abs(lat - prev.lat);
          const lngDiff = Math.abs(lng - prev.lng);
          const headDiff = Math.abs(heading - (prev.heading ?? 0));
          if (latDiff > 0.00001 || lngDiff > 0.00001 || headDiff > 0.1) {
            changed = true;
          }

          return { ...target, lat, lng, heading };
        });

        if (prevCars.length !== targetCarsRef.current.length) {
          changed = true;
        }

        return changed ? nextCars : prevCars;
      });
      interpolationLoopRef.current = requestAnimationFrame(animateDriverMovement);
    };

    interpolationLoopRef.current = requestAnimationFrame(animateDriverMovement);
    return () => {
      if (interpolationLoopRef.current) cancelAnimationFrame(interpolationLoopRef.current);
    };
  }, []);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Native polyline refs — draw directly on map, bypasses React wrapper race condition
  const glowPolyRef = useRef<google.maps.Polyline | null>(null);
  const mainPolyRef = useRef<google.maps.Polyline | null>(null);

  const onUnmount = useCallback(() => {
    glowPolyRef.current?.setMap(null);
    mainPolyRef.current?.setMap(null);
    glowPolyRef.current = null;
    mainPolyRef.current = null;
    mapRef.current = null;
    mapInstanceRef.current = null;
    setMapReady(false);
  }, []);

  const options = useMemo(() => ({
    styles: LIGHT_STYLE,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    preventGoogleFontsLoading: true
  }), []);

  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      setUserHasInteracted(false);
      isProgrammaticRef.current = true;
      mapRef.current?.panTo({ lat, lng });
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 600);
    },
    setZoom: (z: number) => {
      setUserHasInteracted(false);
      isProgrammaticRef.current = true;
      mapRef.current?.setZoom(z);
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 600);
    },
    getMap: () => mapRef.current,
  }));

  const onLoad = useCallback((m: google.maps.Map) => {
    mapRef.current = m;
    mapInstanceRef.current = m;
    setMapReady(true);
  }, []);

  // Safe listener registration for map dragging and zoom interactions
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const dragStartListener = map.addListener('dragstart', () => {
      setIsDragging(true);
      setUserHasInteracted(true);
      if (onDraggingStateChange) onDraggingStateChange(true);
      if (onFollowModeChange) onFollowModeChange(false);
    });

    const dragEndListener = map.addListener('dragend', () => {
      setIsDragging(false);
      if (onDraggingStateChange) onDraggingStateChange(false);
    });

    const zoomListener = map.addListener('zoom_changed', () => {
      if (!isProgrammaticRef.current) {
        setUserHasInteracted(true);
        if (onFollowModeChange) onFollowModeChange(false);
      }
    });

    return () => {
      dragStartListener.remove();
      dragEndListener.remove();
      zoomListener.remove();
    };
  }, [mapReady, onDraggingStateChange, onFollowModeChange]);

  // Safe listener registration for idle event to handle coordinate resolution and grid loading dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const idleListener = map.addListener('idle', async () => {
      const z = map.getZoom() || 0;
      const loadGrid = z >= 17.5;
      map.data.setStyle({ visible: loadGrid, strokeColor: '#777777', strokeWeight: 0.5 });

      // Notify parent of central position update when selection is active
      const mapCenter = map.getCenter();
      if (mapCenter && isSelectingPickup && onCenterPinChange) {
        onCenterPinChange(mapCenter.lat(), mapCenter.lng());
      }

      if (!loadGrid) return;
      if (gridTimeoutRef.current) {
        clearTimeout(gridTimeoutRef.current);
      }
      gridTimeoutRef.current = setTimeout(async () => {
         const bounds = map.getBounds();
        if (!bounds) return;
        try {
          const geoJson = await getGridSection(
            bounds.getSouthWest().lat(), bounds.getSouthWest().lng(),
            bounds.getNorthEast().lat(), bounds.getNorthEast().lng()
          );
          gridFeatures.current.forEach(f => map.data.remove(f));
          if (geoJson?.features) gridFeatures.current = map.data.addGeoJson(geoJson);
        } catch (e) {}
      }, 350);
    });

    return () => {
      idleListener.remove();
    };
  }, [mapReady, isSelectingPickup, onCenterPinChange]);

  // ── NATIVE POLYLINE DRAWING ──────────────────────────────────────────────────
  // Draws directly on the Google Maps instance (bypasses React wrapper race condition).
  // Sky-blue route line — always visible: uses direct bearing when directions unavailable.
  useEffect(() => {
    const map = mapInstanceRef.current;

    // Clear existing native polylines on every re-run
    glowPolyRef.current?.setMap(null);
    mainPolyRef.current?.setMap(null);
    glowPolyRef.current = null;
    mainPolyRef.current = null;

    if (!map || !mapReady || !isLoaded || !memoizedRouteTo) return;

    const origin = memoizedRouteFrom || memoizedCenter;
    let path: google.maps.LatLngLiteral[] = [];

    if (forceDirect || !directions) {
      // Direct bearing line — exact start to exact end
      path = [
        { lat: origin.lat, lng: origin.lng },
        { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
      ];
    } else if (directions.routes[0]?.overview_path) {
      const routePath = directions.routes[0].overview_path as unknown as google.maps.LatLng[];

      // Convert to plain literals
      const middle = routePath.map(p => ({
        lat: typeof p.lat === 'function' ? p.lat() : (p as any).lat,
        lng: typeof p.lng === 'function' ? p.lng() : (p as any).lng,
      }));

      // Always stitch: exact origin → road path → exact destination
      // This closes BOTH gaps regardless of API snapping
      path = [
        { lat: origin.lat, lng: origin.lng },   // ← exact GPS/w3w start
        ...middle,
        { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng }, // ← exact w3w end pin
      ];
    }

    if (path.length < 2) return;

    // Glow layer: wide, translucent sky blue halo
    glowPolyRef.current = new google.maps.Polyline({
      path,
      map,
      strokeColor: '#38bdf8',
      strokeWeight: 14,
      strokeOpacity: 0.22,
      geodesic: true,
      zIndex: 1,
    });

    // Primary layer: solid sky blue line
    mainPolyRef.current = new google.maps.Polyline({
      path,
      map,
      strokeColor: '#0ea5e9',
      strokeWeight: 5,
      strokeOpacity: 1.0,
      geodesic: true,
      zIndex: 2,
    });

    return () => {
      glowPolyRef.current?.setMap(null);
      mainPolyRef.current?.setMap(null);
      glowPolyRef.current = null;
      mainPolyRef.current = null;
    };
  }, [mapReady, isLoaded, directions, memoizedRouteTo, memoizedRouteFrom, memoizedCenter, forceDirect]);

  // ── DIRECTIONS API FETCH ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !isLoaded || !memoizedRouteTo || forceDirect) {
      setDirections(null);
      return;
    }

    const origin = memoizedRouteFrom || memoizedCenter;
    const ds = new google.maps.DirectionsService();

    const mode = travelMode === 'WALKING' ? google.maps.TravelMode.WALKING :
                 travelMode === 'BICYCLING' ? google.maps.TravelMode.BICYCLING :
                 travelMode === 'TRANSIT' ? google.maps.TravelMode.TRANSIT :
                 google.maps.TravelMode.DRIVING;

    ds.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
        travelMode: mode,
        optimizeWaypoints: false,
        provideRouteAlternatives: false,
      },
      (res, status) => {
        // On success upgrade to road-mapped route; on fail the native effect
        // already shows a direct bearing line (directions stays null)
        if (status === 'OK' && res) setDirections(res);
        else setDirections(null);
      }
    );
  }, [mapReady, isLoaded, memoizedRouteTo, memoizedRouteFrom, memoizedCenter, travelMode, forceDirect]);

  // Handle programmatically Zoom States
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !zoomState) return;
    if (userHasInteracted) return;

    isProgrammaticRef.current = true;
    const timer = setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 600);

    if (zoomState === 'city') {
      map.setZoom(12);
      map.setTilt(0);
      map.setHeading(0);
    } else if (zoomState === 'pickup') {
      map.setZoom(17.5);
      map.setTilt(30);
    } else if (zoomState === 'tracking') {
      map.setTilt(0);
      map.setHeading(0);
      const meMarker = markers.find(mark => mark.type === 'me');
      const targetMarker = markers.find(mark => mark.type === 'tracked' || mark.type === 'car');
      if (meMarker && targetMarker) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: meMarker.lat, lng: meMarker.lng });
        bounds.extend({ lat: targetMarker.lat, lng: targetMarker.lng });
        map.fitBounds(bounds, { top: 120, bottom: 280, left: 60, right: 60 });
      } else if (meMarker) {
        map.panTo({ lat: meMarker.lat, lng: meMarker.lng });
        map.setZoom(15);
      } else if (targetMarker) {
        map.panTo({ lat: targetMarker.lat, lng: targetMarker.lng });
        map.setZoom(15);
      }
    } else if (zoomState === 'navigation') {
      map.setZoom(18);
      map.setTilt(45);
      const meMarker = markers.find(mark => mark.type === 'me');
      if (meMarker && meMarker.heading !== undefined) {
        map.setHeading(meMarker.heading);
      }
    }

    return () => clearTimeout(timer);
  }, [mapReady, zoomState, markers, userHasInteracted]);

  // Handle follow mode positioning
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (followMode && map && mapReady) {
      if (userHasInteracted) return;
      const meMarker = markers.find(m => m.type === 'me');
      if (meMarker) {
        isProgrammaticRef.current = true;
        const timer = setTimeout(() => {
          isProgrammaticRef.current = false;
        }, 600);

        map.panTo({ lat: meMarker.lat, lng: meMarker.lng });
        map.setTilt(45);
        if (meMarker.heading !== undefined) {
          map.setHeading(meMarker.heading);
        }

        return () => clearTimeout(timer);
      }
    }
  }, [followMode, mapReady, markers, userHasInteracted]);

  if (!isLoaded) return (
    <div className={className} style={{ background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Premium Radar...</span>
      </div>
    </div>
  );

  const me = markers.find(m => m.type === 'me');
  const otherMarkers = markers.filter(m => m.type !== 'car');
  const allRenderedMarkers = [...otherMarkers, ...liveCars];

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={currentMapCenter}
        zoom={currentMapZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={(e) => onClick && e.latLng && onClick(e.latLng.lat(), e.latLng.lng())}
        options={options}
      >
        {allRenderedMarkers.map((m, idx) => {
          let icon: google.maps.Icon | google.maps.Symbol;

          if (m.type === 'me') {
            icon = {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3.5,
            };
          } else if (m.type === 'car') {
            // Check category if it exists
            const iconUrl = m.category === 'bike' ? '/icon-bike.png' : '/icon-taxi.png';
            icon = imgIcon(iconUrl, 48);
          } else if (m.type === 'request') {
            icon = {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#32B259',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: 1.5,
              anchor: new google.maps.Point(12, 22),
            };
          } else if (m.type === 'place') {
            icon = {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#8E2DE2', // Premium Neon Violet
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5,
              scale: 1.4,
              anchor: new google.maps.Point(12, 22),
            };
          } else if (m.type === 'tracked') {
            icon = { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#02CCFE', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 };
          } else {
            icon = { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#FFD600', fillOpacity: 1, strokeColor: '#000000', strokeWeight: 2 };
          }

          const stableKey = `marker-${m.type}-${m.label ? m.label.replace(/\s+/g, '-') : idx}`;

          return (
            <MarkerF
              key={stableKey}
              position={{ lat: m.lat, lng: m.lng }}
              icon={icon}
              title={m.label}
              zIndex={m.type === 'me' ? 20 : m.type === 'car' ? 15 : 10}
              onClick={() => m.onClick && m.onClick()}
            />
          );
        })}

        {me?.accuracy && (
          <Circle
            center={{ lat: me.lat, lng: me.lng }}
            radius={me.accuracy}
            options={{ fillColor: '#4285F4', fillOpacity: 0.08, strokeColor: '#4285F4', strokeOpacity: 0.15, strokeWeight: 1 }}
          />
        )}


        {/* Route polylines are drawn natively on mapInstance via useRef — see glowPolyRef / mainPolyRef above */}

        {routeTo && (
          <>
            {/* Wider glowing target accuracy ring that shrinks as the user gets closer */}
            <Circle
              center={{ lat: routeTo.lat, lng: routeTo.lng }}
              radius={
                distToDest !== null
                  ? Math.min(60, Math.max(10, distToDest))
                  : 30
              }
              options={{
                fillColor: '#10b981', // Emerald green
                fillOpacity: 0.08,
                strokeColor: '#10b981',
                strokeOpacity: 0.35,
                strokeWeight: 1.5,
              }}
            />
            {/* Inner lock core ring */}
            <Circle
              center={{ lat: routeTo.lat, lng: routeTo.lng }}
              radius={10}
              options={{
                fillColor: '#10b981',
                fillOpacity: 0.18,
                strokeColor: '#10b981',
                strokeOpacity: 0.75,
                strokeWeight: 2,
                visible: distToDest !== null && distToDest <= 50
              }}
            />
          </>
        )}
      </GoogleMap>

      {/* 1. FIXED CENTER PICKUP PIN OVERLAY */}
      {isSelectingPickup && (
        <div 
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 40
          }}
        >
          {/* Animated radar pulsing ring */}
          <div className="pulse-ring-element" />

          {/* Scaling bottom drop shadow */}
          <div 
            className={`absolute left-1/2 rounded-full bg-black/35 blur-[2.5px] pointer-events-none ${
              isDragging ? 'shadow-active' : 'shadow-idle'
            }`}
            style={{
              width: 18,
              height: 5,
              bottom: -2.5,
              transform: 'translateX(-50%)'
            }}
          />

          {/* Premium customized visual pin component */}
          <div 
            className={`absolute bottom-0 left-1/2 origin-bottom pointer-events-none ${
              isDragging ? 'pin-active' : 'pin-idle'
            }`}
            style={{
              transform: 'translateX(-50%)',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div className="relative flex flex-col items-center">
              {/* Vibrant yellow circle with solid black borders and internal precision lock */}
              <div className="w-11 h-11 rounded-full bg-[#FFD600] border-2 border-black flex items-center justify-center shadow-lg transform translate-y-[-2px]">
                <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
              {/* Solid needle locking on central pixel */}
              <div className="w-1 h-3.5 bg-black transform translate-y-[-3px]" />
            </div>
          </div>
        </div>
      )}

      {/* 2. LOCATION CONFIDENCE CHIP (GPS status) — bottom-left, non-intrusive */}
      {me?.accuracy && me.accuracy > 20 && (
        <div className="absolute bottom-6 left-4 z-50 bg-black/75 text-white text-[9px] font-black uppercase tracking-[1.2px] px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur border border-white/10 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
          <span>GPS fixing…</span>
        </div>
      )}
    </div>
  );
});

MapBase.displayName = 'MapBase';
export default MapBase;
