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
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => {
    if (!code) return;
    const s = getSocket();

    const handleLocation = (data: SessionLocationUpdate) => setLocation(data);
    const handleStatus = (data: { status: string }) => setStatus(data.status);
    const handleViewerCount = (data: { count: number }) => setViewerCount(data.count);
    const handleArrived = (data: { name: string; timestamp: number }) => setArrived(data);

    s.on("location", handleLocation);
    s.on("host-moved", handleLocation);
    s.on("status", handleStatus);
    s.on("viewer-count", handleViewerCount);
    s.on("member-arrived", handleArrived);

    const cleanupReconnect = onReconnect(() => {
      if (codeRef.current) s.emit("join", codeRef.current);
    });

    return () => {
      s.emit("leave", code);
      s.off("location", handleLocation);
      s.off("host-moved", handleLocation);
      s.off("status", handleStatus);
      s.off("viewer-count", handleViewerCount);
      s.off("member-arrived", handleArrived);
      cleanupReconnect();
    };
  }, [code]);

  return { location, status, viewerCount, arrived };
}
