'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;       // metres
  heading?: number;       // degrees 0-360, north = 0
  speed?: number;         // m/s
  timestamp: number;
}

export type GeoPosition = Position;

interface Options {
  /**
   * Share-session token from POST /api/v1/location/share.
   * When provided, positions are pushed to the backend automatically.
   */
  shareToken?: string | null;

  /**
   * Base URL for the API. Defaults to '' (same origin).
   */
  apiBase?: string;

  /**
   * Auth token for the Authorization header.
   */
  authToken?: string | null;

  /**
   * Minimum distance moved (metres) before triggering a backend push.
   * Default: 5 m — prevents hammering the API while standing still.
   */
  minMoveMetres?: number;

  /**
   * Minimum interval between backend pushes (ms). Default: 3000.
   */
  pushIntervalMs?: number;

  /**
   * desiredAccuracy passed to watchPosition. Default: true (high accuracy).
   */
  highAccuracy?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Bearing in degrees (0 = north) from point a → b */
function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGeolocation(
  enabledOrWatch: boolean | Options = true,
  options: Options = {},
): {
  position: Position | null;
  error: string | null;
  isWatching: boolean;
  loading: boolean;
} {
  // FORCE enabled to always be true to keep the geolocation watcher constantly active ("always online")
  const enabled = true;
  const actualOptions = typeof enabledOrWatch === 'object' ? enabledOrWatch : options;

  const {
    shareToken      = null,
    apiBase         = '',
    authToken       = null,
    minMoveMetres   = 5,
    pushIntervalMs  = 3_000,
    highAccuracy    = true,
  } = actualOptions;

  const [position, setPosition]     = useState<Position | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading]       = useState(true);

  // Refs so we can read latest values inside callbacks without stale closures
  const prevPosRef      = useRef<Position | null>(null);
  const lastPushTimeRef = useRef<number>(0);
  const lastPushPosRef  = useRef<Position | null>(null);
  const shareTokenRef   = useRef(shareToken);
  const authTokenRef    = useRef(authToken);

  useEffect(() => { shareTokenRef.current = shareToken; }, [shareToken]);
  useEffect(() => { authTokenRef.current  = authToken;  }, [authToken]);

  // ── Backend push ──────────────────────────────────────────────────────────
  const pushToBackend = useCallback(async (pos: Position) => {
    const token = shareTokenRef.current;
    if (!token) return;

    const now = Date.now();
    const prev = lastPushPosRef.current;

    // Rate-limit: wait at least pushIntervalMs between pushes
    if (now - lastPushTimeRef.current < pushIntervalMs) return;

    // Distance gate: only push if moved minMoveMetres
    if (prev && haversineMetres(prev, pos) < minMoveMetres) return;

    lastPushTimeRef.current = now;
    lastPushPosRef.current  = pos;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authTokenRef.current) headers['Authorization'] = `Bearer ${authTokenRef.current}`;

      await fetch(`${apiBase}/api/v1/location/share/${token}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          latitude:  pos.lat,
          longitude: pos.lng,
          accuracy:  pos.accuracy,
          heading:   pos.heading,
          speed:     pos.speed,
        }),
      });
    } catch {
      // Non-fatal — position is still updated locally
    }
  }, [apiBase, minMoveMetres, pushIntervalMs]);

  // ── watchPosition ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoading(false);
      return;
    }

    let watchId: number;
    let active = true;

    const startWatching = () => {
      if (!active) return;
      setIsWatching(true);

      watchId = navigator.geolocation.watchPosition(
        (raw) => {
          if (!active) return;
          const { latitude, longitude, accuracy, speed } = raw.coords;

          // Use native heading if available (> 0 means device is moving)
          // Otherwise compute bearing from last known position
          let heading: number | undefined = raw.coords.heading ?? undefined;
          const prev = prevPosRef.current;

          if (
            (heading === null || heading === undefined || isNaN(heading)) &&
            prev !== null &&
            haversineMetres(prev, { lat: latitude, lng: longitude }) > 2
          ) {
            heading = bearingDegrees(prev, { lat: latitude, lng: longitude });
          }

          const next: Position = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy ?? 0,
            heading,
            speed: speed ?? undefined,
            timestamp: raw.timestamp,
          };

          prevPosRef.current = next;
          setPosition(next);
          setError(null);
          setLoading(false);

          // Push to backend asynchronously (fire-and-forget)
          pushToBackend(next);
        },
        (err) => {
          if (!active) return;
          setError(err.message);
          setLoading(false);

          // Self-healing: restart the browser watcher after 3 seconds if we hit a GPS/hardware error
          // This keeps the geolocation "always online" and immune to standard timeout failures
          navigator.geolocation.clearWatch(watchId);
          setTimeout(() => {
            if (active) startWatching();
          }, 3000);
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: 2_000,   // accept cached positions up to 2 s old
          timeout: 10_000,     // give up waiting after 10 s
        },
      );
    };

    startWatching();

    return () => {
      active = false;
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
      setIsWatching(false);
    };
  // Only re-register the watcher if `enabled` or `highAccuracy` changes.
  // pushToBackend is stable (useCallback with no changing deps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, highAccuracy, pushToBackend]);

  return { position, error, isWatching, loading };
}
