"use client";
import { useEffect, useRef, useState } from "react";
import { getSocket, onReconnect } from "@/lib/socket";

export interface SessionLocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  timestamp?: number;
}

export interface ViewerLocationUpdate {
  viewerId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
  mode?: string;
}

/**
 * One-way live tracking of a single share/SOS/ride code — joins the room
 * on (re)connect and listens for the events the backend's `/loc` namespace
 * emits to it. Used by /track/[code] and the active-SOS view.
 */
export function useSessionSocket(code: string | null | undefined) {
  const [location, setLocation] = useState<SessionLocationUpdate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [arrived, setArrived] = useState<{ name: string; timestamp: number } | null>(null);
  const [viewersLoc, setViewersLoc] = useState<Record<string, ViewerLocationUpdate>>({});
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    if (!code) return;
    const s = getSocket();

    const handleLocation = (data: SessionLocationUpdate) => setLocation(data);
    const handleStatus = (data: { status: string }) => setStatus(data.status);
    const handleViewerCount = (data: { count: number }) => setViewerCount(data.count);
    const handleArrived = (data: { name: string; timestamp: number }) => setArrived(data);
    const handleViewerLocation = (data: ViewerLocationUpdate) => {
      setViewersLoc((prev) => ({
        ...prev,
        [data.viewerId]: {
          ...data,
          timestamp: data.timestamp ?? Date.now(),
        },
      }));
    };

    s.on("location", handleLocation);
    s.on("host-moved", handleLocation);
    s.on("status", handleStatus);
    s.on("viewer-count", handleViewerCount);
    s.on("member-arrived", handleArrived);
    s.on("viewer-location", handleViewerLocation);

    const cleanupReconnect = onReconnect(() => {
      if (codeRef.current) s.emit("join", codeRef.current);
    });

    // Prune stale viewers every 10 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      setViewersLoc((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, loc] of Object.entries(next)) {
          if (now - loc.timestamp > 30000) { // 30 seconds timeout
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 10000);

    return () => {
      s.emit("leave", code);
      s.off("location", handleLocation);
      s.off("host-moved", handleLocation);
      s.off("status", handleStatus);
      s.off("viewer-count", handleViewerCount);
      s.off("member-arrived", handleArrived);
      s.off("viewer-location", handleViewerLocation);
      cleanupReconnect();
      clearInterval(interval);
    };
  }, [code]);

  return { location, status, viewerCount, arrived, viewersLoc };
}
