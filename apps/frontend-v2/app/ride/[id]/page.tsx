"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Phone, Star, Check } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useRideSocket } from "@/features/ride/useRideSocket";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import { formatDistance, formatDuration } from "@/features/location/geo";
import { getRide, cancelRide, rateRide } from "@/lib/api";
import type { Ride, RideStatus } from "@/types/api";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const STATUS_COPY: Record<RideStatus, string> = {
  requested: "Looking for a nearby driver…",
  accepted: "Your driver is on the way",
  arriving: "Your driver is almost at your pickup",
  arrived: "Your driver has arrived",
  started: "On your way",
  completed: "Trip complete",
  cancelled: "Ride cancelled",
};

const CANCELLABLE: RideStatus[] = ["requested", "accepted", "arriving"];

export default function RideTrackingPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rideId = params.id;

  const position = useLocationStore((s) => s.displayPosition);
  const { statusUpdate, driverLocation, notification } = useRideSocket(rideId);

  const [ride, setRide] = useState<Ride | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [rated, setRated] = useState(false);

  const routeLegRef = useRef<"pickup" | "destination" | null>(null);

  useEffect(() => {
    if (!rideId) return;
    getRide(rideId)
      .then(setRide)
      .catch(() => toast.error("Couldn't load this ride"));
  }, [rideId]);

  // Merge live status updates from the socket onto the fetched ride.
  useEffect(() => {
    if (!statusUpdate) return;
    setRide((prev) =>
      prev
        ? {
            ...prev,
            status: statusUpdate.status,
            driver: prev.driver
              ? { ...prev.driver, fullName: statusUpdate.driverName, vehicleModel: statusUpdate.vehicleModel, licensePlate: statusUpdate.licensePlate }
              : {
                  id: statusUpdate.helperId ?? "",
                  fullName: statusUpdate.driverName,
                  phoneNumber: null,
                  vehicleModel: statusUpdate.vehicleModel,
                  vehicleColor: null,
                  licensePlate: statusUpdate.licensePlate,
                  rating: 0,
                  currentLat: null,
                  currentLng: null,
                },
          }
        : prev
    );
  }, [statusUpdate]);

  useEffect(() => {
    if (notification) toast.message(notification.title, { description: notification.message });
  }, [notification]);

  // Recompute the route polyline only when the target leg changes (pickup
  // vs destination) or the driver's location is first known — not on every
  // 3-5s driver-location tick, which would hammer the Directions API.
  useEffect(() => {
    if (!ride || !driverLocation) return;
    const preArrival = ride.status === "accepted" || ride.status === "arriving";
    const leg = preArrival ? "pickup" : "destination";
    if (routeLegRef.current === leg && route) return;
    routeLegRef.current = leg;
    const target = preArrival ? { lat: ride.pickupLat, lng: ride.pickupLng } : { lat: ride.destinationLat, lng: ride.destinationLng };
    computeRoute({ lat: driverLocation.lat, lng: driverLocation.lng }, target, "DRIVING", GOOGLE_KEY).then(setRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, driverLocation?.lat, driverLocation?.lng]);

  const handleCancel = async () => {
    if (!rideId) return;
    setCancelling(true);
    try {
      await cancelRide(rideId);
      router.replace("/navigate");
    } catch {
      toast.error("Couldn't cancel — try again");
    } finally {
      setCancelling(false);
    }
  };

  const handleRate = async () => {
    if (!rideId || rating === 0) return;
    setSubmittingRating(true);
    try {
      await rateRide(rideId, rating, comment.trim() || undefined);
      setRated(true);
    } catch {
      toast.error("Couldn't submit your rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  const markers = useMemo(() => {
    if (!ride) return [];
    const m = [
      { id: "pickup", lat: ride.pickupLat, lng: ride.pickupLng, label: "Pickup", color: "#16A34A" },
      { id: "dest", lat: ride.destinationLat, lng: ride.destinationLng, label: "Destination", color: "#DC2626" },
    ];
    if (driverLocation) m.push({ id: "driver", lat: driverLocation.lat, lng: driverLocation.lng, label: "Driver", color: "#0F172A" });
    return m;
  }, [ride, driverLocation]);

  if (!ready || !ride) return null;

  return (
    <div className="relative h-full w-full">
      <MapBase
        me={position}
        markers={markers}
        routePoints={route?.polylinePoints ?? []}
        initialCenter={driverLocation ?? position ?? { lat: ride.pickupLat, lng: ride.pickupLng }}
      />

      {CANCELLABLE.includes(ride.status) && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform disabled:opacity-40"
          aria-label="Cancel ride"
        >
          <X className="h-5 w-5 text-foreground" />
        </button>
      )}

      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-20 rounded-3xl bg-card p-5 shadow-2xl">
        <p className="text-lg font-extrabold text-foreground">{STATUS_COPY[ride.status]}</p>

        {driverLocation && (ride.status === "accepted" || ride.status === "arriving" || ride.status === "started") && (
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {formatDistance(driverLocation.distanceMeters)} away · {formatDuration(driverLocation.etaSeconds)}
          </p>
        )}

        {ride.driver && (ride.status === "accepted" || ride.status === "arriving" || ride.status === "arrived" || ride.status === "started") && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{ride.driver.fullName ?? "Your driver"}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {[ride.driver.vehicleModel, ride.driver.licensePlate].filter(Boolean).join(" · ") || "On the way"}
              </p>
            </div>
            {ride.driver.phoneNumber && (
              <a
                href={`tel:${ride.driver.phoneNumber}`}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95 transition-transform"
                aria-label="Call driver"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {CANCELLABLE.includes(ride.status) && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-4 h-12 w-full rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            {cancelling ? "Cancelling…" : "Cancel ride"}
          </button>
        )}

        {ride.status === "completed" && !rated && (
          <div className="mt-4">
            <p className="text-sm font-bold text-foreground">Rate your trip</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                  <Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything you'd like to add? (optional)"
              className="mt-3 h-20 w-full resize-none rounded-2xl bg-secondary p-3 text-sm font-medium text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleRate}
              disabled={rating === 0 || submittingRating}
              className="mt-3 h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              {submittingRating ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        )}

        {ride.status === "completed" && rated && (
          <button
            onClick={() => router.replace("/navigate")}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            <Check className="h-4 w-4" /> Done
          </button>
        )}

        {ride.status === "cancelled" && (
          <button
            onClick={() => router.replace("/navigate")}
            className="mt-4 h-12 w-full rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
