'use client';
import { GoogleMap, Circle, MarkerF } from '@react-google-maps/api';
import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { getGridSection } from '../lib/api';
import { computeRoute } from '../lib/routeService';

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

export interface RouteInfo {
  distanceMetres: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  nextStep: string;
  straightLineMetres: number;
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
  onRouteInfo?: (info: RouteInfo | null) => void;
  showNavBanner?: boolean;
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

// ── HELPERS ──────────────────────────────────────────────────────────────────

/** Haversine distance in metres between two coordinates. */
function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aa =
    sinLat * sinLat +
    Math.cos(a.lat * (Math.PI / 180)) *
      Math.cos(b.lat * (Math.PI / 180)) *
      sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

/** Build RouteInfo from a Routes API result for the NavBanner. */
function routeResultToInfo(
  result: { distanceMeters: number; durationSeconds: number; firstStepInstruction?: string },
  slm: number,
): RouteInfo {
  const dm = result.distanceMeters;
  const ds = result.durationSeconds;
  return {
    distanceMetres:     dm,
    distanceText:       dm >= 1000 ? `${(dm / 1000).toFixed(1)} km` : `${Math.round(dm)} m`,
    durationSeconds:    ds,
    durationText:       ds >= 3600
      ? `${Math.floor(ds / 3600)}h ${Math.floor((ds % 3600) / 60)} min`
      : `${Math.round(ds / 60)} min`,
    nextStep:           result.firstStepInstruction || 'Follow the route',
    straightLineMetres: slm,
  };
}

function NavBanner({ info, travelMode }: { info: RouteInfo; travelMode?: string }) {
  const icon = travelMode === 'WALKING' ? '🚶' : travelMode === 'BICYCLING' ? '🚲' : travelMode === 'TRANSIT' ? '🚌' : '🚗';
  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 12, right: 12, zIndex: 50,
      background: '#000080', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'none',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFFFFF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Next</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {info.nextStep || 'Follow the route'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
          {info.distanceText || (info.straightLineMetres >= 1000 ? `${(info.straightLineMetres/1000).toFixed(1)} km` : `${Math.round(info.straightLineMetres)} m`)}
        </div>
        {info.durationText && (
          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2 }}>{info.durationText}</div>
        )}
      </div>
    </div>
  );
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

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
  forceDirect = false,
  onRouteInfo,
  showNavBanner = false,
}, ref) => {
  const { isLoaded } = useGoogleMaps();

  // ── Map instance ──────────────────────────────────────────────────────────
  const mapRef           = useRef<google.maps.Map | null>(null);
  const mapInstanceRef   = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Polyline refs (drawn natively) ────────────────────────────────────────
  const glowPolyRef = useRef<google.maps.Polyline | null>(null);
  const mainPolyRef = useRef<google.maps.Polyline | null>(null);

  // ── Route state (Routes API replaces DirectionsService) ─────────────────
  const [routePoints, setRoutePoints] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [routeInfo,   setRouteInfo]   = useState<RouteInfo | null>(null);

  // ── Stable origin: debounce GPS jitter — only update after > 50 m movement ─
  const [stableOrigin, setStableOrigin] = useState<{ lat: number; lng: number }>(routeFrom ?? center);

  useEffect(() => {
    const next = routeFrom ?? center;
    if (haversineMetres(stableOrigin, next) > 50) {
      setStableOrigin({ lat: next.lat, lng: next.lng });
    }
  }, [routeFrom?.lat, routeFrom?.lng, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memo wrappers (keyed on coordinates so object refs are stable)
  const memoizedRouteTo = useMemo(
    () => routeTo ? { lat: routeTo.lat, lng: routeTo.lng } : undefined,
    [routeTo?.lat, routeTo?.lng],
  );

  const memoizedRouteFrom = useMemo(
    () => routeFrom ? { lat: routeFrom.lat, lng: routeFrom.lng } : undefined,
    [routeFrom?.lat, routeFrom?.lng],
  );

  const memoizedCenter = useMemo(
    () => ({ lat: center.lat, lng: center.lng }),
    [center.lat, center.lng],
  );

  // Distance to destination (metres)
  const distToDest = useMemo(() => {
    if (!routeFrom || !routeTo) return null;
    return haversineMetres(routeFrom, routeTo);
  }, [routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const gridFeatures    = useRef<google.maps.Data.Feature[]>([]);
  const gridTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag / user-interaction locks ─────────────────────────────────────────
  const [isDragging, setIsDragging]               = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [currentMapCenter, setCurrentMapCenter]   = useState(center);
  const [currentMapZoom, setCurrentMapZoom]       = useState(zoom);
  const isProgrammaticRef    = useRef(false);
  const lastZoomStateRef     = useRef<string | undefined>(undefined);
  const lastFollowModeRef    = useRef<boolean>(false);

  useEffect(() => {
    if (!userHasInteracted) setCurrentMapCenter({ lat: center.lat, lng: center.lng });
  }, [center.lat, center.lng, userHasInteracted]);

  useEffect(() => {
    if (!userHasInteracted) setCurrentMapZoom(zoom);
  }, [zoom, userHasInteracted]);

  useEffect(() => {
    if (zoomState !== lastZoomStateRef.current || followMode !== lastFollowModeRef.current) {
      lastZoomStateRef.current  = zoomState;
      lastFollowModeRef.current = followMode;
      setUserHasInteracted(false);
    }
  }, [zoomState, followMode]);

  // ── Car LERP animation ────────────────────────────────────────────────────
  const [liveCars, setLiveCars]       = useState<MarkerData[]>([]);
  const targetCarsRef                 = useRef<MarkerData[]>([]);
  const interpolationLoopRef          = useRef<number | null>(null);

  useEffect(() => {
    const cars = markers.filter(m => m.type === 'car');
    targetCarsRef.current = cars;
    if (liveCars.length === 0 && cars.length > 0) setLiveCars(cars);
  }, [markers]);

  useEffect(() => {
    const lerp = (s: number, e: number, t: number) => (1 - t) * s + t * e;

    const animate = () => {
      setLiveCars(prev => {
        if (targetCarsRef.current.length === 0) return prev.length === 0 ? prev : [];
        let changed = false;
        const next = targetCarsRef.current.map(target => {
          const p = prev.find(x => x.label === target.label)
                  ?? prev.find(x => Math.abs(x.lat - target.lat) < 0.1 && Math.abs(x.lng - target.lng) < 0.1);
          if (!p) { changed = true; return target; }

          const f = 0.08;
          const lat = lerp(p.lat, target.lat, f);
          const lng = lerp(p.lng, target.lng, f);

          let heading = p.heading ?? 0;
          let diff = (target.heading ?? 0) - heading;
          while (diff < -180) diff += 360;
          while (diff >  180) diff -= 360;
          heading = (heading + diff * f + 360) % 360;

          if (
            Math.abs(lat - p.lat) > 0.00001 ||
            Math.abs(lng - p.lng) > 0.00001 ||
            Math.abs(heading - (p.heading ?? 0)) > 0.1
          ) changed = true;

          return { ...target, lat, lng, heading };
        });
        if (prev.length !== targetCarsRef.current.length) changed = true;
        return changed ? next : prev;
      });
      interpolationLoopRef.current = requestAnimationFrame(animate);
    };

    interpolationLoopRef.current = requestAnimationFrame(animate);
    return () => { if (interpolationLoopRef.current) cancelAnimationFrame(interpolationLoopRef.current); };
  }, []);

  // ── Map callbacks ─────────────────────────────────────────────────────────
  const onLoad = useCallback((m: google.maps.Map) => {
    mapRef.current         = m;
    mapInstanceRef.current = m;
    setMapReady(true);
  }, []);

  const onUnmount = useCallback(() => {
    glowPolyRef.current?.setMap(null);
    mainPolyRef.current?.setMap(null);
    glowPolyRef.current        = null;
    mainPolyRef.current        = null;
    mapRef.current             = null;
    mapInstanceRef.current     = null;
    setMapReady(false);
  }, []);

  const options = useMemo(() => ({
    styles: LIGHT_STYLE,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    preventGoogleFontsLoading: true,
  }), []);

  useImperativeHandle(ref, () => ({
    panTo: (lat, lng) => {
      setUserHasInteracted(false);
      isProgrammaticRef.current = true;
      mapRef.current?.panTo({ lat, lng });
      setTimeout(() => { isProgrammaticRef.current = false; }, 600);
    },
    setZoom: (z) => {
      setUserHasInteracted(false);
      isProgrammaticRef.current = true;
      mapRef.current?.setZoom(z);
      setTimeout(() => { isProgrammaticRef.current = false; }, 600);
    },
    getMap: () => mapRef.current,
  }));

  // ── Drag / zoom listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const ds = map.addListener('dragstart', () => {
      setIsDragging(true);
      setUserHasInteracted(true);
      onDraggingStateChange?.(true);
      onFollowModeChange?.(false);
    });
    const de = map.addListener('dragend', () => {
      setIsDragging(false);
      onDraggingStateChange?.(false);
    });
    const zl = map.addListener('zoom_changed', () => {
      if (!isProgrammaticRef.current) {
        setUserHasInteracted(true);
        onFollowModeChange?.(false);
      }
    });

    return () => { ds.remove(); de.remove(); zl.remove(); };
  }, [mapReady, onDraggingStateChange, onFollowModeChange]);

  // ── Idle listener (grid + center pin) ────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const il = map.addListener('idle', async () => {
      const z = map.getZoom() ?? 0;
      const loadGrid = z >= 17.5;
      map.data.setStyle({ visible: loadGrid, strokeColor: '#777777', strokeWeight: 0.5 });

      const mc = map.getCenter();
      if (mc && isSelectingPickup && onCenterPinChange) {
        onCenterPinChange(mc.lat(), mc.lng());
      }

      if (!loadGrid) return;
      if (gridTimeoutRef.current) clearTimeout(gridTimeoutRef.current);
      gridTimeoutRef.current = setTimeout(async () => {
        const bounds = map.getBounds();
        if (!bounds) return;
        try {
          const geoJson = await getGridSection(
            bounds.getSouthWest().lat(), bounds.getSouthWest().lng(),
            bounds.getNorthEast().lat(), bounds.getNorthEast().lng(),
          );
          gridFeatures.current.forEach(f => map.data.remove(f));
          if (geoJson?.features) gridFeatures.current = map.data.addGeoJson(geoJson);
        } catch { /* ignore */ }
      }, 350);
    });

    return () => { il.remove(); };
  }, [mapReady, isSelectingPickup, onCenterPinChange]);

  // ── ROUTES API FETCH (replaces deprecated DirectionsService) ─────────────
  //
  // • BICYCLING → falls back to WALK automatically (no ZERO_RESULTS in Africa)
  // • Debounced 800 ms + 50 m movement gate to prevent API hammering
  // • Uses cancellation token to discard stale responses
  const routeFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapReady || !isLoaded || !memoizedRouteTo || forceDirect) {
      setRoutePoints(null);
      setRouteInfo(null);
      onRouteInfo?.(null);
      return;
    }

    const origin = stableOrigin;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

    if (routeFetchTimerRef.current) clearTimeout(routeFetchTimerRef.current);

    let cancelled = false;

    routeFetchTimerRef.current = setTimeout(() => {
      computeRoute(origin, memoizedRouteTo, travelMode ?? 'DRIVING', apiKey).then(result => {
        if (cancelled) return;

        if (result && result.polylinePoints.length >= 2) {
          // Stitch exact GPS origin + road path + exact destination pin
          setRoutePoints([
            { lat: origin.lat, lng: origin.lng },
            ...result.polylinePoints,
            { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
          ]);
          const slm = distToDest ?? haversineMetres(origin, memoizedRouteTo);
          const info = routeResultToInfo(result, slm);
          setRouteInfo(info);
          onRouteInfo?.(info);
        } else {
          // Routes API failed → straight-line fallback with distance estimate
          setRoutePoints(null);
          const slm = distToDest ?? haversineMetres(origin, memoizedRouteTo);
          const fb: RouteInfo = {
            distanceMetres:     slm,
            distanceText:       slm >= 1000 ? `${(slm / 1000).toFixed(1)} km` : `${Math.round(slm)} m`,
            durationSeconds:    0,
            durationText:       '',
            nextStep:           'Head towards destination',
            straightLineMetres: slm,
          };
          setRouteInfo(fb);
          onRouteInfo?.(fb);
        }
      });
    }, 800);

    return () => {
      cancelled = true;
      if (routeFetchTimerRef.current) clearTimeout(routeFetchTimerRef.current);
    };
  }, [mapReady, isLoaded, memoizedRouteTo?.lat, memoizedRouteTo?.lng, travelMode, forceDirect, stableOrigin.lat, stableOrigin.lng]);

  // ── NATIVE POLYLINE DRAWING (Uber-style: white border + blue core) ────────
  //
  // Redraws whenever routePoints changes (new Routes API fetch) OR the user
  // position updates (live GPS tracking). No extra API call is made on position
  // updates — routePoints is already the cached road path.
  useEffect(() => {
    const map = mapInstanceRef.current;

    glowPolyRef.current?.setMap(null);
    mainPolyRef.current?.setMap(null);
    glowPolyRef.current = null;
    mainPolyRef.current = null;

    if (!map || !mapReady || !isLoaded || !memoizedRouteTo) return;

    // Use Routes API road path if available, else fall back to direct bearing
    const origin = memoizedRouteFrom ?? memoizedCenter;
    const path: google.maps.LatLngLiteral[] = routePoints ?? [
      { lat: origin.lat, lng: origin.lng },
      { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
    ];

    if (path.length < 2) return;

    // ── Layer 1: wide white border — gives the road-painted look ──────────
    glowPolyRef.current = new google.maps.Polyline({
      path, map,
      strokeColor:   '#FFFFFF',
      strokeWeight:  11,
      strokeOpacity: 1.0,
      geodesic:      true,
      zIndex:        1,
    });

    // ── Layer 2: solid Uber-blue core ─────────────────────────────────────
    mainPolyRef.current = new google.maps.Polyline({
      path, map,
      strokeColor:   '#276EF1',   // Uber blue
      strokeWeight:  7,
      strokeOpacity: 1.0,
      geodesic:      true,
      zIndex:        2,
    });

    return () => {
      glowPolyRef.current?.setMap(null);
      mainPolyRef.current?.setMap(null);
      glowPolyRef.current = null;
      mainPolyRef.current = null;
    };
  }, [mapReady, isLoaded, routePoints, memoizedRouteTo, memoizedRouteFrom, memoizedCenter, forceDirect]);

  // ── ZOOM STATE ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !zoomState || userHasInteracted) return;

    isProgrammaticRef.current = true;
    const timer = setTimeout(() => { isProgrammaticRef.current = false; }, 600);

    if (zoomState === 'city') {
      map.setZoom(12); map.setTilt(0); map.setHeading(0);
      map.panTo(center);
    } else if (zoomState === 'pickup') {
      map.setZoom(17.5); map.setTilt(30);
      map.panTo(center);
    } else if (zoomState === 'tracking') {
      map.setTilt(0); map.setHeading(0);
      const userMarker = markers.find(m => m.type === 'me' || m.type === 'car');
      const origin = routeFrom || (userMarker ? { lat: userMarker.lat, lng: userMarker.lng } : center);
      
      const targetMarker = markers.find(m => 
        (m.type === 'tracked' || m.type === 'request' || m.type === 'place') ||
        (m.type === 'car' && m !== userMarker)
      );
      const destination = routeTo || (targetMarker ? { lat: targetMarker.lat, lng: targetMarker.lng } : null);

      if (origin && destination) {
        const b = new google.maps.LatLngBounds();
        b.extend(origin);
        b.extend(destination);
        map.fitBounds(b, { top: 120, bottom: 280, left: 60, right: 60 });
      } else if (origin) {
        map.panTo(origin); map.setZoom(15);
      } else if (destination) {
        map.panTo(destination); map.setZoom(15);
      }
    } else if (zoomState === 'navigation') {
      const userMarker = markers.find(m => m.type === 'me' || m.type === 'car');
      const origin = routeFrom || (userMarker ? { lat: userMarker.lat, lng: userMarker.lng } : center);
      const destination = routeTo;

      if (followMode && origin) {
        map.setZoom(17.5);
        map.setTilt(45);
        map.panTo(origin);
        if (userMarker?.heading !== undefined) {
          map.setHeading(userMarker.heading);
        }
      } else if (origin && destination) {
        // Fit bounds to show the entire route line from one location to another
        map.setTilt(0);
        map.setHeading(0);
        const b = new google.maps.LatLngBounds();
        b.extend(origin);
        b.extend(destination);
        map.fitBounds(b, { top: 120, bottom: 280, left: 60, right: 60 });
      } else if (origin) {
        map.panTo(origin);
        map.setZoom(16);
      }
    }

    return () => clearTimeout(timer);
  }, [mapReady, zoomState, markers, userHasInteracted, routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng, center.lat, center.lng, followMode]);

  // ── FOLLOW MODE ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!followMode || !map || !mapReady || userHasInteracted) return;

    const me = markers.find(m => m.type === 'me' || m.type === 'car');
    if (!me) return;

    isProgrammaticRef.current = true;
    const timer = setTimeout(() => { isProgrammaticRef.current = false; }, 600);

    map.panTo({ lat: me.lat, lng: me.lng });
    map.setTilt(45);
    if (me.heading !== undefined) map.setHeading(me.heading);

    return () => clearTimeout(timer);
  }, [followMode, mapReady, markers, userHasInteracted]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (!isLoaded) return (
    <div className={className} style={{ background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '4px solid #FFD600', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading map…</span>
      </div>
    </div>
  );

  const me             = markers.find(m => m.type === 'me');
  const otherMarkers   = markers.filter(m => m.type !== 'car');
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
            // Precise GPS blue dot — kept small & exact for accuracy
            icon = {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3.5,
            };
          } else if (m.type === 'car') {
            icon = imgIcon(m.category === 'bike' ? '/icon-bike.png' : '/icon-taxi.png', 48);
          } else if (m.type === 'request') {
            // 3D navy blue location pin for pickup / request waypoints
            icon = {
              url: '/icon-3d-pin-blue.png',
              scaledSize: new google.maps.Size(52, 62),
              anchor: new google.maps.Point(26, 58),
            };
          } else if (m.type === 'place') {
            // 3D yellow destination pin for saved places
            icon = {
              url: '/icon-3d-dest-pin.png',
              scaledSize: new google.maps.Size(48, 58),
              anchor: new google.maps.Point(24, 54),
            };
          } else if (m.type === 'tracked') {
            // 3D yellow destination pin for tracked people/destinations
            icon = {
              url: '/icon-3d-dest-pin.png',
              scaledSize: new google.maps.Size(48, 58),
              anchor: new google.maps.Point(24, 54),
            };
          } else {
            // Fallback 3D blue pin
            icon = {
              url: '/icon-3d-pin-blue.png',
              scaledSize: new google.maps.Size(48, 58),
              anchor: new google.maps.Point(24, 54),
            };
          }

          return (
            <MarkerF
              key={`marker-${m.type}-${m.label ? m.label.replace(/\s+/g, '-') : idx}`}
              position={{ lat: m.lat, lng: m.lng }}
              icon={icon}
              title={m.label}
              zIndex={m.type === 'me' ? 20 : m.type === 'car' ? 15 : 10}
              onClick={() => m.onClick?.()}
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

        {routeTo && (
          <>
            <Circle
              center={{ lat: routeTo.lat, lng: routeTo.lng }}
              radius={distToDest !== null ? Math.min(60, Math.max(10, distToDest)) : 30}
              options={{ fillColor: '#000080', fillOpacity: 0.08, strokeColor: '#000080', strokeOpacity: 0.35, strokeWeight: 1.5 }}
            />
            <Circle
              center={{ lat: routeTo.lat, lng: routeTo.lng }}
              radius={10}
              options={{
                fillColor: '#000080', fillOpacity: 0.18,
                strokeColor: '#000080', strokeOpacity: 0.75, strokeWeight: 2,
                visible: distToDest !== null && distToDest <= 50,
              }}
            />
          </>
        )}
      </GoogleMap>

      {/* Fixed centre pickup pin — 3D icon */}
      {isSelectingPickup && (
        <div
          className="absolute pointer-events-none"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -100%)', zIndex: 40 }}
        >
          {/* Pulsing ground shadow ring */}
          <div
            className="absolute left-1/2 pointer-events-none transition-all duration-300"
            style={{
              bottom: isDragging ? -12 : -6,
              transform: 'translateX(-50%)',
              width: isDragging ? 28 : 20,
              height: isDragging ? 10 : 6,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.22)',
              filter: 'blur(3px)',
            }}
          />

          {/* 3D navy pin image — lifts on drag */}
          <img
            src="/icon-3d-pin-blue.png"
            alt="Pickup location"
            draggable={false}
            className="pointer-events-none select-none transition-transform duration-300"
            style={{
              width: 60,
              height: 72,
              objectFit: 'contain',
              transform: isDragging ? 'translateY(-12px) scale(1.1)' : 'translateY(0px) scale(1)',
              filter: isDragging ? 'drop-shadow(0 16px 12px rgba(0,0,0,0.35))' : 'drop-shadow(0 8px 6px rgba(0,0,0,0.22))',
            }}
          />
        </div>
      )}

      {/* GPS accuracy chip */}
      {me?.accuracy && me.accuracy > 20 && (
        <div className="absolute bottom-6 left-4 z-50 bg-black/75 text-white text-[9px] font-black uppercase tracking-[1.2px] px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur border border-white/10 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
          <span>GPS fixing…</span>
        </div>
      )}

      {showNavBanner && routeInfo && <NavBanner info={routeInfo} travelMode={travelMode} />}
    </div>
  );
});

MapBase.displayName = 'MapBase';
export default MapBase;
