"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { haversineMeters, bearing, shouldPush } from "./geo";
import { updateShareSession } from "@/lib/api";

export interface Position {
  lat: number;
  lng: number;
  accuracy: number; // metres
  heading?: number; // degrees 0-360, north = 0
  speed?: number; // m/s
  timestamp: number;
}

interface Options {
  /** Share-session token. When set, positions are pushed to the backend automatically. */
  shareToken?: string | null;
  /** Minimum distance moved (metres) before pushing to the backend. Default 5m. */
  minMoveMetres?: number;
  /** Minimum interval between backend pushes (ms). Default 3000ms. */
  pushIntervalMs?: number;
}

/**
 * Continuous GPS watcher (watchPosition, not polling). Restarts itself
 * 3s after any geolocation error so it survives transient GPS dropouts —
 * this differs from a typical "request once" hook on purpose.
 *
 * Heading: uses the device's reported heading when valid; otherwise
 * derives it from the bearing between the last two fixes, but only once
 * movement exceeds 2m, so GPS jitter while stationary doesn't spin the
 * heading randomly.
 */
export function useGeolocation(options: Options = {}) {
  const { shareToken, minMoveMetres = 5, pushIntervalMs = 3000 } = options;
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  const prevPositionRef = useRef<Position | null>(null);
  const lastPushRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareTokenRef = useRef(shareToken);
  shareTokenRef.current = shareToken;

  const pushToBackend = useCallback(
    (pos: Position) => {
      const token = shareTokenRef.current;
      if (!token) return;
      const last = lastPushRef.current;
      if (!shouldPush(last, pos, minMoveMetres, pushIntervalMs)) return;
      lastPushRef.current = { lat: pos.lat, lng: pos.lng, time: Date.now() };
      updateShareSession(token, { lat: pos.lat, lng: pos.lng }).catch(() => {
        // Fire-and-forget — a missed location push isn't fatal.
      });
    },
    [minMoveMetres, pushIntervalMs]
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    function start() {
      const id = navigator.geolocation.watchPosition(
        (raw) => {
          const prev = prevPositionRef.current;
          let heading = raw.coords.heading ?? undefined;

          if ((heading === undefined || heading === null || Number.isNaN(heading)) && prev) {
            const moved = haversineMeters(prev.lat, prev.lng, raw.coords.latitude, raw.coords.longitude);
            if (moved > 2) {
              heading = bearing(prev.lat, prev.lng, raw.coords.latitude, raw.coords.longitude);
            } else {
              heading = prev.heading;
            }
          }

          const next: Position = {
            lat: raw.coords.latitude,
            lng: raw.coords.longitude,
            accuracy: raw.coords.accuracy,
            heading,
            speed: raw.coords.speed ?? undefined,
            timestamp: raw.timestamp,
          };

          prevPositionRef.current = next;
          setPosition(next);
          setError(null);
          pushToBackend(next);
        },
        (err) => {
          setError(err);
          // Restart the watch after a transient error instead of giving up.
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          restartTimerRef.current = setTimeout(start, 3000);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
      watchIdRef.current = id;
    }

    start();

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [pushToBackend]);

  return { position, error };
}
