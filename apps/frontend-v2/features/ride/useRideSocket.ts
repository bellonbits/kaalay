"use client";
import { useEffect, useRef, useState } from "react";
import { getSocket, onReconnect } from "@/lib/socket";
import type { RideChatMessage, RideStatus } from "@/types/api";

export interface RideStatusUpdate {
  id: string;
  status: RideStatus;
  driverName: string | null;
  vehicleModel: string | null;
  licensePlate: string | null;
  helperId: string | null;
}

export interface RideLocationUpdate {
  id: string;
  lat: number;
  lng: number;
  heading?: number | null;
  distanceMeters: number;
  etaSeconds: number;
}

export interface RideNotification {
  id: string;
  title: string;
  message: string;
  type: string;
}

/**
 * Joins a ride's Socket.IO room and streams status/driver-location/notification
 * events for it. Kept separate from useSessionSocket (share/SOS codes) since
 * ride payloads carry driver/vehicle/ETA detail those don't.
 */
export function useRideSocket(rideId: string | null) {
  const [statusUpdate, setStatusUpdate] = useState<RideStatusUpdate | null>(null);
  const [driverLocation, setDriverLocation] = useState<RideLocationUpdate | null>(null);
  const [notification, setNotification] = useState<RideNotification | null>(null);
  const [chatMessage, setChatMessage] = useState<RideChatMessage | null>(null);
  const rideIdRef = useRef(rideId);
  rideIdRef.current = rideId;

  useEffect(() => {
    if (!rideId) return;
    const s = getSocket();

    const handleStatus = (data: RideStatusUpdate) => setStatusUpdate(data);
    const handleLocation = (data: RideLocationUpdate) => setDriverLocation(data);
    const handleNotification = (data: RideNotification) => setNotification(data);
    const handleChatMessage = (data: RideChatMessage) => setChatMessage(data);

    s.on("status", handleStatus);
    s.on("driver-location", handleLocation);
    s.on("notification", handleNotification);
    s.on("chat-message", handleChatMessage);

    const cleanupReconnect = onReconnect(() => {
      if (rideIdRef.current) s.emit("join", rideIdRef.current);
    });

    return () => {
      s.emit("leave", rideId);
      s.off("status", handleStatus);
      s.off("driver-location", handleLocation);
      s.off("notification", handleNotification);
      s.off("chat-message", handleChatMessage);
      cleanupReconnect();
    };
  }, [rideId]);

  return { statusUpdate, driverLocation, notification, chatMessage };
}
