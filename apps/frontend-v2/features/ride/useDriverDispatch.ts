"use client";
import { useEffect, useRef, useState } from "react";
import { getSocket, onReconnect } from "@/lib/socket";
import { useLocationStore } from "@/features/location/store";
import { shouldPush } from "@/features/location/geo";

export interface JobOffer {
  rideId: string;
  /** what3words — the assignment worker only sends the address, not coordinates. */
  pickup: string;
  destination: string;
  fare: number;
  distanceKm: number;
  category: string;
}

const LOCATION_PUSH_MIN_METERS = 30;
const LOCATION_PUSH_MIN_INTERVAL_MS = 5000;

/**
 * Wires a driver into the real dispatch protocol implemented in
 * core/sio.py + services/assignment.py. This protocol uses two *different*
 * ids that are easy to conflate:
 *  - "go-online"/"go-offline" must carry the driver's **User** id — the
 *    assignment worker emits matched job offers to `room=str(driver.userId)`.
 *  - "update-location" must carry the **Driver row's** id — the worker's
 *    Redis GEOSEARCH result is looked up via `Driver.id == driver_id`
 *    (and the REST /drivers/status endpoint's zrem on going offline uses
 *    the same `Driver.id` key), so feeding it the user id would make this
 *    driver silently invisible to dispatch despite seeming "online".
 *  - the assignment worker only finds this driver via that GEOSEARCH, fed
 *    by "update-location" — not by the REST /drivers/status endpoint —
 *    so going online must also start streaming position over the socket.
 *  - matched rides arrive as a private "job_offer" event (not the broadcast
 *    "new-request" event, which is the SOS/lost-person broadcast path).
 */
export function useDriverDispatch(userId: string | null, driverId: string | null, online: boolean) {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const displayPosition = useLocationStore((s) => s.displayPosition);
  const lastPushRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const s = getSocket();
    if (online) s.emit("go-online", { driverId: userId });
    else s.emit("go-offline", { driverId: userId });

    const cleanupReconnect = online ? onReconnect(() => s.emit("go-online", { driverId: userId })) : undefined;
    return () => cleanupReconnect?.();
  }, [userId, online]);

  useEffect(() => {
    const s = getSocket();
    const handleOffer = (data: JobOffer) =>
      setOffers((prev) => [data, ...prev.filter((o) => o.rideId !== data.rideId)]);
    s.on("job_offer", handleOffer);
    return () => {
      s.off("job_offer", handleOffer);
    };
  }, []);

  useEffect(() => {
    if (!online || !driverId || !displayPosition) return;
    if (!shouldPush(lastPushRef.current, displayPosition, LOCATION_PUSH_MIN_METERS, LOCATION_PUSH_MIN_INTERVAL_MS)) return;
    lastPushRef.current = { lat: displayPosition.lat, lng: displayPosition.lng, time: Date.now() };
    getSocket().emit("update-location", { lat: displayPosition.lat, lng: displayPosition.lng, driverId });
  }, [online, driverId, displayPosition]);

  const dismissOffer = (rideId: string) => setOffers((prev) => prev.filter((o) => o.rideId !== rideId));

  return { offers, dismissOffer };
}
