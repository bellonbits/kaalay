"use client";
import { useEffect, useRef } from "react";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useRoadSnap } from "@/features/location/useRoadSnap";
import { useLocationStore } from "@/features/location/store";
import { useShareStore } from "@/features/share/store";
import { convertToWords } from "@/lib/api";

/**
 * Mounted once (in AppShell) so the GPS watch runs continuously while the
 * user is signed in, mirrored into useLocationStore so every screen reads
 * the same live fix instead of each starting its own watchPosition. Also
 * the single place that pushes positions to an active Share session — so
 * starting a share never spins up a second, redundant GPS watch.
 */
export default function LocationWatcher() {
  const activeToken = useShareStore((s) => s.activeToken);
  const { position } = useGeolocation({ shareToken: activeToken });
  const { displayPosition } = useRoadSnap(position);
  const setPosition = useLocationStore((s) => s.setPosition);
  const setDisplayPosition = useLocationStore((s) => s.setDisplayPosition);
  const setCurrentWords = useLocationStore((s) => s.setCurrentWords);
  const lastResolvedRef = useRef<string | null>(null);

  useEffect(() => {
    setPosition(position);
  }, [position, setPosition]);

  useEffect(() => {
    setDisplayPosition(displayPosition);
  }, [displayPosition, setDisplayPosition]);

  useEffect(() => {
    if (!position) return;
    const key = `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
    if (key === lastResolvedRef.current) return;

    const t = setTimeout(() => {
      convertToWords(position.lat, position.lng)
        .then((res) => {
          lastResolvedRef.current = key;
          setCurrentWords(res.words);
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [position, setCurrentWords]);

  return null;
}
