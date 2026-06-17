"use client";
import { useEffect, useRef } from "react";
import { useLocationStore } from "@/features/location/store";
import { shouldPush } from "@/features/location/geo";
import { updateDriverRideLocation } from "@/lib/api";

const MIN_MOVE_METERS = 10;
const MIN_INTERVAL_MS = 3000;

/**
 * While `active` (the current user is the driver on an in-progress ride),
 * pushes the live road-snapped position to the backend on the same
 * move/interval gate `useGeolocation` uses for share-session pushes. The
 * backend auto-promotes ride status (ARRIVING/ARRIVED) off these pushes and
 * streams them to the rider over the ride's Socket.IO room.
 */
export function useRideLocationPush(rideId: string | null, active: boolean) {
  const displayPosition = useLocationStore((s) => s.displayPosition);
  const lastPushRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!active || !rideId || !displayPosition) return;
    if (!shouldPush(lastPushRef.current, displayPosition, MIN_MOVE_METERS, MIN_INTERVAL_MS)) return;
    lastPushRef.current = { lat: displayPosition.lat, lng: displayPosition.lng, time: Date.now() };
    updateDriverRideLocation(rideId, {
      lat: displayPosition.lat,
      lng: displayPosition.lng,
      heading: displayPosition.heading,
      speed: displayPosition.speed,
    }).catch(() => {});
  }, [active, rideId, displayPosition]);
}
