"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMaps } from "./GoogleMapsProvider";
import { getGridSection } from "@/lib/api";
import { destinationPoint } from "@/features/location/geo";

export interface MapMarkerData {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MapBaseProps {
  /** Live GPS position to render as the blue "me" dot. */
  me?: { lat: number; lng: number; heading?: number; accuracy?: number } | null;
  /** Route polyline points, in order. */
  routePoints?: { lat: number; lng: number }[];
  /** Static markers (places, facilities, incidents). */
  markers?: MapMarkerData[];
  onMarkerClick?: (id: string) => void;
  /** Shows a fixed center pin and reports the map center as the user pans
   * underneath it — the Uber/Bolt-style location-picking pattern. */
  pickingMode?: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  /** Keeps the camera centered + rotated on `me` (turn-by-turn follow mode). */
  follow?: boolean;
  /** Biases the follow camera this many metres ahead of `me` along the
   * current heading, so more of the upcoming route is visible instead of
   * the live dot sitting dead-center — the "pan forward" turn-by-turn feel. */
  lookAheadMeters?: number;
  /** Fired the instant the user drags the map themselves (not a
   * programmatic pan) — callers use this to drop out of follow mode so
   * a touch-drag isn't fought by the camera snapping back every frame. */
  onUserDrag?: () => void;
  /** Renders the what3words 3m grid once zoomed in close enough. */
  showGrid?: boolean;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  /** When set, the camera fits to contain every point in this list — for
   * showing a route preview that spans two points far apart instead of
   * forcing a single center+zoom. Re-fits whenever the array reference
   * changes (callers should memoize/only pass a new array when the
   * points actually change). */
  fitBounds?: { lat: number; lng: number }[];
  className?: string;
}

const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 }; // Nairobi fallback before GPS resolves
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const LERP_FACTOR = 0.08; // ~8%/frame smoothing for the live position dot
const GRID_MIN_ZOOM = 17;
const FOLLOW_ZOOM = 18;

function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export default function MapBase({
  me,
  routePoints,
  markers,
  onMarkerClick,
  pickingMode,
  onCenterChange,
  follow,
  lookAheadMeters,
  onUserDrag,
  showGrid,
  initialCenter,
  initialZoom = 16,
  fitBounds,
  className,
}: MapBaseProps) {
  const { isLoaded } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const meMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const accuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const polylineBorderRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const animatedRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const targetRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const wasFollowingRef = useRef(false);
  const followRef = useRef(false);
  const lookAheadRef = useRef(0);
  const gridLayerRef = useRef<google.maps.Data | null>(null);
  const gridDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGridBoundsRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Map creation (once) ────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return;
    const map = new google.maps.Map(containerRef.current, {
      center: initialCenter ?? DEFAULT_CENTER,
      zoom: initialZoom,
      mapId: MAP_ID,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      clickableIcons: false,
    });
    mapRef.current = map;
    polylineBorderRef.current = new google.maps.Polyline({
      map,
      strokeColor: "#FFFFFF",
      strokeWeight: 11,
      strokeOpacity: 0.9,
      zIndex: 1,
    });
    polylineRef.current = new google.maps.Polyline({
      map,
      strokeColor: "#16A34A",
      strokeWeight: 6,
      strokeOpacity: 1,
      zIndex: 2,
    });
    gridLayerRef.current = new google.maps.Data({ map });
    gridLayerRef.current.setStyle({
      strokeColor: "#16A34A",
      strokeWeight: 1,
      strokeOpacity: 0.35,
      clickable: false,
    });
    setMapReady(true);

    map.addListener("idle", () => {
      const c = map.getCenter();
      if (c && onCenterChange) onCenterChange(c.lat(), c.lng());
    });

    // 'dragstart' only fires for user gestures, never for our own
    // panTo/moveCamera calls — a clean signal to drop out of follow mode.
    map.addListener("dragstart", () => onUserDrag?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ── what3words grid overlay — fetched on idle once zoomed in close
  //    enough, debounced so panning doesn't hammer the API. ──────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !showGrid) {
      gridLayerRef.current?.forEach((f) => gridLayerRef.current?.remove(f));
      return;
    }
    const map = mapRef.current;

    const fetchGrid = () => {
      const zoom = map.getZoom() ?? 0;
      const layer = gridLayerRef.current;
      if (!layer) return;
      if (zoom < GRID_MIN_ZOOM) {
        layer.forEach((f) => layer.remove(f));
        lastGridBoundsRef.current = null;
        return;
      }
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const key = `${sw.lat().toFixed(4)},${sw.lng().toFixed(4)},${ne.lat().toFixed(4)},${ne.lng().toFixed(4)}`;
      if (key === lastGridBoundsRef.current) return;
      lastGridBoundsRef.current = key;

      getGridSection(sw.lat(), sw.lng(), ne.lat(), ne.lng())
        .then((geojson) => {
          if (!gridLayerRef.current) return;
          gridLayerRef.current.forEach((f) => gridLayerRef.current?.remove(f));
          if (geojson?.features?.length) gridLayerRef.current.addGeoJson(geojson as object);
        })
        .catch(() => {});
    };

    const listener = map.addListener("idle", () => {
      if (gridDebounceRef.current) clearTimeout(gridDebounceRef.current);
      gridDebounceRef.current = setTimeout(fetchGrid, 350);
    });
    fetchGrid();

    return () => {
      google.maps.event.removeListener(listener);
      if (gridDebounceRef.current) clearTimeout(gridDebounceRef.current);
    };
  }, [mapReady, showGrid]);

  // ── Route polyline updates (setPath on the bound-once polyline, never
  //    recreated — avoids race conditions on remount that broke this in
  //    the previous frontend) ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const path = (routePoints ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
    polylineRef.current?.setPath(path);
    polylineBorderRef.current?.setPath(path);
  }, [mapReady, routePoints]);

  // ── Fit camera to a set of points (e.g. a route preview spanning a
  //    custom origin and a destination far apart) instead of forcing a
  //    single center+zoom. ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !fitBounds || fitBounds.length === 0) return;
    if (fitBounds.length === 1) {
      mapRef.current.panTo(fitBounds[0]);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const point of fitBounds) bounds.extend(point);
    mapRef.current.fitBounds(bounds, 64);
  }, [mapReady, fitBounds]);

  // ── "Me" marker + accuracy circle — updates the target the animation
  //    loop below interpolates toward. Deliberately does NOT touch rafRef:
  //    restarting requestAnimationFrame on every GPS tick (every 1-3s)
  //    used to cancel-and-relaunch the LERP loop constantly, which is
  //    wasteful and risks visible stutter on slower devices. ────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!me) return;

    if (!targetRef.current) {
      animatedRef.current = { lat: me.lat, lng: me.lng, heading: me.heading ?? 0 };
    }
    targetRef.current = { lat: me.lat, lng: me.lng, heading: me.heading ?? animatedRef.current?.heading ?? 0 };

    if (!meMarkerRef.current) {
      const dot = document.createElement("div");
      dot.style.width = "18px";
      dot.style.height = "18px";
      dot.style.borderRadius = "50%";
      dot.style.background = "#16A34A";
      dot.style.border = "3px solid white";
      dot.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
      meMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: me.lat, lng: me.lng },
        content: dot,
        zIndex: 999,
      });
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = new google.maps.Circle({
        map: mapRef.current,
        fillColor: "#16A34A",
        fillOpacity: 0.08,
        strokeColor: "#16A34A",
        strokeOpacity: 0.15,
        strokeWeight: 1,
      });
    }
    accuracyCircleRef.current.setCenter({ lat: me.lat, lng: me.lng });
    accuracyCircleRef.current.setRadius(me.accuracy ?? 15);
  }, [mapReady, me]);

  // Zoom in tight the moment follow mode engages, so the user's exact
  // position (even inside a building) is clearly visible — but only on
  // that transition, not every frame, so it doesn't fight manual zoom.
  useEffect(() => {
    followRef.current = !!follow;
    if (follow && !wasFollowingRef.current && mapRef.current) {
      mapRef.current.setZoom(FOLLOW_ZOOM);
    }
    wasFollowingRef.current = !!follow;
  }, [follow]);

  useEffect(() => {
    lookAheadRef.current = lookAheadMeters ?? 0;
  }, [lookAheadMeters]);

  // ── Continuous LERP animation loop — started once the map is ready and
  //    left running for the component's lifetime, reading targetRef/
  //    followRef fresh every frame instead of being torn down and rebuilt
  //    on every position update. ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;

    const tick = () => {
      const current = animatedRef.current;
      const target = targetRef.current;
      if (current && target && meMarkerRef.current) {
        const nextLat = current.lat + (target.lat - current.lat) * LERP_FACTOR;
        const nextLng = current.lng + (target.lng - current.lng) * LERP_FACTOR;
        const nextHeading = current.heading + shortestHeadingDelta(current.heading, target.heading) * LERP_FACTOR;
        animatedRef.current = { lat: nextLat, lng: nextLng, heading: nextHeading };
        meMarkerRef.current.position = { lat: nextLat, lng: nextLng };

        if (followRef.current && mapRef.current) {
          const center =
            lookAheadRef.current > 0
              ? destinationPoint(nextLat, nextLng, nextHeading, lookAheadRef.current)
              : { lat: nextLat, lng: nextLng };
          mapRef.current.moveCamera({ center, heading: nextHeading });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mapReady]);

  // ── Static markers (places, facilities) ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const seen = new Set<string>();
    for (const m of markers ?? []) {
      seen.add(m.id);
      let marker = markersRef.current.get(m.id);
      if (!marker) {
        const pin = document.createElement("div");
        pin.style.width = "14px";
        pin.style.height = "14px";
        pin.style.borderRadius = "50%";
        pin.style.background = m.color ?? "#0F172A";
        pin.style.border = "2px solid white";
        pin.style.boxShadow = "0 1px 3px rgba(0,0,0,0.4)";
        if (onMarkerClick) pin.style.cursor = "pointer";
        marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: m.lat, lng: m.lng },
          content: pin,
          title: m.label,
          gmpClickable: !!onMarkerClick,
        });
        if (onMarkerClick) {
          const id = m.id;
          marker.addListener("click", () => onMarkerClick(id));
        }
        markersRef.current.set(m.id, marker);
      } else {
        marker.position = { lat: m.lat, lng: m.lng };
      }
    }
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.map = null;
        markersRef.current.delete(id);
      }
    }
  }, [mapReady, markers, onMarkerClick]);

  const panTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.panTo({ lat, lng });
  }, []);

  useEffect(() => {
    if (initialCenter && mapReady) panTo(initialCenter.lat, initialCenter.lng);
    // Only on first ready — subsequent centering is via `follow`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {pickingMode && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex flex-col items-center"
          style={{ transform: "translate(-50%, -100%)" }}
        >
          <div className="h-6 w-6 rounded-full bg-emergency shadow-lg ring-4 ring-white" />
          <div className="-mt-1 h-3 w-1 bg-emergency" />
        </div>
      )}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary text-sm font-semibold text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}
