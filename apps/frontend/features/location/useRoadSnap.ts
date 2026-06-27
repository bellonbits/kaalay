"use client";
import { useEffect, useRef, useState } from "react";
import { haversineMeters, shouldPush } from "./geo";
import { snapToRoad } from "@/lib/api";
import type { Position } from "./useGeolocation";

const ON_ROAD_THRESHOLD_METERS = 25;
const MIN_MOVE_METERS = 8;
const MIN_INTERVAL_MS = 2500;

/**
 * Refines a raw GPS stream onto the actual road surface via the backend's
 * Roads API proxy. Snapping is debounced (not called on every GPS tick) and
 * only trusted when the snapped point sits within ON_ROAD_THRESHOLD_METERS
 * of the raw fix — otherwise the user is genuinely off-road (indoors, a
 * footpath, a parking lot) and dragging their dot onto the nearest street
 * would be wrong, so raw GPS is used instead.
 */
export function useRoadSnap(position: Position | null) {
  const [snapOffset, setSnapOffset] = useState<{ lat: number; lng: number } | null>(null);
  const [onRoad, setOnRoad] = useState(false);
  const prevRawRef = useRef<Position | null>(null);
  const lastRequestRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!position) return;
    const prevRaw = prevRawRef.current;
    prevRawRef.current = position;

    if (!shouldPush(lastRequestRef.current, position, MIN_MOVE_METERS, MIN_INTERVAL_MS)) return;
    lastRequestRef.current = { lat: position.lat, lng: position.lng, time: Date.now() };

    const points = prevRaw ? [prevRaw, position] : [position];
    const requestId = ++requestIdRef.current;

    snapToRoad(points)
      .then(({ snappedPoints }) => {
        if (requestId !== requestIdRef.current) return; // superseded by a newer request
        const snapped = snappedPoints[snappedPoints.length - 1];
        if (!snapped) {
          setOnRoad(false);
          setSnapOffset(null);
          return;
        }
        const distance = haversineMeters(position.lat, position.lng, snapped.lat, snapped.lng);
        if (distance < ON_ROAD_THRESHOLD_METERS) {
          setOnRoad(true);
          setSnapOffset({ lat: snapped.lat, lng: snapped.lng });
        } else {
          setOnRoad(false);
          setSnapOffset(null);
        }
      })
      .catch(() => {
        setOnRoad(false);
        setSnapOffset(null);
      });
  }, [position]);

  const displayPosition: Position | null =
    position && onRoad && snapOffset ? { ...position, lat: snapOffset.lat, lng: snapOffset.lng } : position;

  return { displayPosition, onRoad };
}
