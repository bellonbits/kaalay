'use client';
import { GoogleMap, Circle } from '@react-google-maps/api';
import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { getGridSection } from '../lib/api';
import { computeRoute } from '../lib/routeService';
import AdvancedMarker from './AdvancedMarker';
import PinIcon from './PinIcon';
import W3WMapOverlay from './W3WMapOverlay';

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
  pickingType?: 'start' | 'dest' | null;
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

const MEMBER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F7DC6F', '#82E0AA'];

function getMemberColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MEMBER_COLORS.length;
  return MEMBER_COLORS[index];
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
  pickingType = 'start',
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
  const lastReportedLatRef = useRef<number | null>(null);
  const lastReportedLngRef = useRef<number | null>(null);

  // ── Native polylines (avoids @react-google-maps/api Polyline race condition) ─
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  // Latest route path, readable from onLoad when a (re)created map needs to
  // seed its polylines with the current route immediately.
  const routePathRef = useRef<google.maps.LatLngLiteral[] | null>(null);

  // ── Route state (Routes API replaces DirectionsService) ─────────────────
  const [routePoints, setRoutePoints] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [routeInfo,   setRouteInfo]   = useState<RouteInfo | null>(null);

  // ── Stable origin: debounce GPS jitter — only update after > 50 m movement ─
  // Seed directly from routeFrom if available, otherwise fall back to center.
  // This ensures navigation-loaded coords (from URL params) are valid immediately.
  const [stableOrigin, setStableOrigin] = useState<{ lat: number; lng: number }>(
    () => routeFrom ? { lat: routeFrom.lat, lng: routeFrom.lng } : { lat: center.lat, lng: center.lng }
  );

  useEffect(() => {
    if (!routeFrom) return;
    const next = { lat: routeFrom.lat, lng: routeFrom.lng };
    // Only update stableOrigin when the user has physically moved >50m (suppresses GPS jitter)
    if (haversineMetres(stableOrigin, next) > 50) {
      setStableOrigin(next);
    }
  }, [routeFrom?.lat, routeFrom?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Route polylines are created WITH the map and attached to this exact
    // instance — they can never reference a stale/unmounted map. Afterwards
    // only their path is updated (setPath), never their map binding.
    const border = new google.maps.Polyline({
      map: m,
      path: routePathRef.current ?? [],
      strokeColor: '#FFFFFF',
      strokeWeight: 11,
      strokeOpacity: 1.0,
      geodesic: true,
      zIndex: 1,
    });
    const core = new google.maps.Polyline({
      map: m,
      path: routePathRef.current ?? [],
      strokeColor: '#FFD600',
      strokeWeight: 7,
      strokeOpacity: 1.0,
      geodesic: true,
      zIndex: 2,
    });
    polylinesRef.current = [border, core];

    setMapReady(true);
  }, []);

  const onUnmount = useCallback(() => {
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    mapRef.current             = null;
    mapInstanceRef.current     = null;
    setMapReady(false);
  }, []);

  const options = useMemo(() => ({
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    preventGoogleFontsLoading: true,
    // mapId is required for AdvancedMarkerElement; DEMO_MAP_ID is Google's
    // dev placeholder. Map initialises as RASTER either way on this account.
    mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
    // tilt is managed imperatively in zoom/follow effects via map.setTilt()
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

  // ── Idle listener (grid + center pin with 1m distance threshold) ──────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const il = map.addListener('idle', async () => {
      const z = map.getZoom() ?? 0;
      const loadGrid = z >= 17.5;
      map.data.setStyle({ visible: loadGrid, strokeColor: '#777777', strokeWeight: 0.5 });

      const mc = map.getCenter();
      if (!mc) return;

      const lat = mc.lat();
      const lng = mc.lng();

      // Only fire if position actually changed meaningfully (>1m threshold)
      const latChanged = lastReportedLatRef.current === null || Math.abs(lat - lastReportedLatRef.current) > 0.000009;
      const lngChanged = lastReportedLngRef.current === null || Math.abs(lng - lastReportedLngRef.current) > 0.000009;

      if ((isSelectingPickup || pickingType) && onCenterPinChange && (latChanged || lngChanged)) {
        lastReportedLatRef.current = lat;
        lastReportedLngRef.current = lng;
        onCenterPinChange(lat, lng);
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

    return () => {
      il.remove();
      lastReportedLatRef.current = null;
      lastReportedLngRef.current = null;
    };
  }, [mapReady, isSelectingPickup, onCenterPinChange, pickingType]);

  // ── ROUTES API FETCH (replaces deprecated DirectionsService) ─────────────
  //
  // • BICYCLING → falls back to WALK automatically (no ZERO_RESULTS in Africa)
  // • Debounced 800 ms + 50 m movement gate to prevent API hammering
  // • Uses cancellation token to discard stale responses
  const routeFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRouteKeyRef = useRef<string>('');

  useEffect(() => {
    if (!mapReady || !isLoaded || !memoizedRouteTo || forceDirect) {
      if (forceDirect) {
        // forceDirect = straight line, clear the API-computed path
        setRoutePoints(null);
        setRouteInfo(null);
        onRouteInfo?.(null);
        lastRouteKeyRef.current = '';
      }
      // When routeTo goes null (transient reset), do NOT clear route state or the key —
      // preserving them means the polyline stays drawn and the cache stays warm.
      return;
    }

    const map = mapInstanceRef.current ?? mapRef.current;
    if (!map) return;

    const origin = stableOrigin;
    const mode = travelMode ?? 'DRIVING';
    const key = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}-${memoizedRouteTo.lat.toFixed(6)},${memoizedRouteTo.lng.toFixed(6)}-${mode}`;

    if (key === lastRouteKeyRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

    if (routeFetchTimerRef.current) clearTimeout(routeFetchTimerRef.current);

    let cancelled = false;

    routeFetchTimerRef.current = setTimeout(() => {
      computeRoute(origin, memoizedRouteTo, mode, apiKey).then(result => {
        if (cancelled) return;

        if (result && result.polylinePoints.length >= 2) {
          // Commit the cache key only on success — a cancelled or failed fetch
          // must stay retryable, otherwise the route is never drawn for this key
          lastRouteKeyRef.current = key;
          const stitched = [
            { lat: origin.lat, lng: origin.lng },
            ...result.polylinePoints,
            { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
          ];
          // Stitch exact GPS origin + road path + exact destination pin
          setRoutePoints(stitched);
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

  // ── ROUTE PATH COMPUTATION ────────────────────────────────────────────────
  const routePath = useMemo(() => {
    if (!memoizedRouteTo) return null;

    const origin = memoizedRouteFrom ?? memoizedCenter;

    if (forceDirect) {
      return [
        { lat: origin.lat, lng: origin.lng },
        { lat: memoizedRouteTo.lat, lng: memoizedRouteTo.lng },
      ];
    }

    if (routePoints && routePoints.length >= 2) {
      return routePoints;
    }

    return null;
  }, [forceDirect, routePoints, memoizedRouteFrom, memoizedCenter, memoizedRouteTo]);

  // ── NATIVE POLYLINE PATH UPDATE ───────────────────────────────────────────
  // The polyline objects themselves are created in onLoad (bound to the live
  // map) and destroyed in onUnmount. Here we only push path changes into
  // them — setPath on an attached polyline renders immediately, and an empty
  // path hides the line. No attach/detach races possible.
  useEffect(() => {
    routePathRef.current = routePath;
    const path = routePath && routePath.length >= 2 ? routePath : [];
    polylinesRef.current.forEach(p => p.setPath(path));
  }, [routePath]);

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
  // Belt-and-suspenders: also check at render time that google.maps.Map is a
  // real constructor, not a stub. This catches React 18 Strict Mode double-
  // invoke where isLoaded state is true but the API is between lifecycle calls.
  const mapsApiReady = isLoaded && typeof google !== 'undefined' && typeof google.maps?.Map === 'function';
  if (!mapsApiReady) return (
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
          let content: HTMLElement;
          const categoryLower = m.category?.toLowerCase() || '';
          
          if (categoryLower === 'walking' || categoryLower === 'person') {
            content = PinIcon.person();
          } else if (categoryLower === 'bike' || categoryLower === 'bicycle' || categoryLower === 'motorcycle') {
            content = PinIcon.bike();
          } else if (categoryLower === 'car' || categoryLower === 'taxi' || categoryLower === 'driving' || categoryLower === 'ride') {
            content = PinIcon.car('economy');
          } else {
            if (m.type === 'me') {
              content = PinIcon.me();
            } else if (m.type === 'car') {
              content = PinIcon.car(m.category);
            } else if (m.type === 'request') {
              content = PinIcon.request();
            } else if (m.type === 'place' || m.type === 'tracked') {
              if (m.type === 'tracked' && m.label) {
                content = PinIcon.member(getMemberColor(m.label), m.label);
              } else {
                content = PinIcon.place();
              }
            } else {
              content = PinIcon.request();
            }
          }

          return (
            <AdvancedMarker
              key={`marker-${m.type}-${m.label ? m.label.replace(/\s+/g, '-') : idx}`}
              map={mapInstanceRef.current}
              position={{ lat: m.lat, lng: m.lng }}
              content={content}
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

        {/* Polylines are drawn imperatively via polylinesRef — see useEffect above */}
      </GoogleMap>

      {/* Fixed centre pickup/dest pin — 3D icon */}
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

          {/* 3D pin image — lifts on drag */}
          <img
            src={pickingType === 'dest' ? "/icon-3d-dest-pin.png" : "/icon-3d-pin-blue.png"}
            alt={pickingType === 'dest' ? "Destination location" : "Pickup location"}
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

      {/* w3w grid overlay + click-to-select */}
      <W3WMapOverlay
        map={mapInstanceRef.current ?? mapRef.current}
        apiKey={process.env.NEXT_PUBLIC_W3W_API_KEY || 'Z5Z6G74L'}
        visible={isSelectingPickup || !!pickingType}
        onSquareSelect={(square) => {
          onCenterPinChange?.(square.coordinates.lat, square.coordinates.lng);
        }}
      />
    </div>
  );
});

MapBase.displayName = 'MapBase';
export default MapBase;
