"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import NavigationHud from "@/features/navigation/components/NavigationHud";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useRideSocket } from "@/features/ride/useRideSocket";
import { useRideLocationPush } from "@/features/ride/useRideLocationPush";
import { useNavigationStore } from "@/features/navigation/store";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import { haversineMeters } from "@/features/location/geo";
import { useVoiceGuidance, type VoiceLanguage } from "@/features/navigation/useVoiceGuidance";
import { getRide, signalRideArrived, startRide, completeRide } from "@/lib/api";
import type { Ride, RideStatus } from "@/types/api";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ACTIVE_STATUSES: RideStatus[] = ["accepted", "arriving", "arrived", "started"];

export default function DriverActiveTripPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rideId = params.id;

  const position = useLocationStore((s) => s.displayPosition);
  const { statusUpdate } = useRideSocket(rideId);
  const setImmersive = useNavigationStore((s) => s.setImmersive);

  // Hide BottomNav for the whole active trip — same as /navigate/route while
  // turn-by-turn is running. NavigationHud's bottom bar sits flush at the
  // screen bottom and would otherwise be covered by the nav.
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const [ride, setRide] = useState<Ride | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const legRef = useRef<"pickup" | "destination" | null>(null);
  const lastSpokenStepRef = useRef(-1);
  const voiceLang: VoiceLanguage =
    (typeof window !== "undefined" && (localStorage.getItem("kaalay_voice_lang") as VoiceLanguage)) || "en";
  const { speak } = useVoiceGuidance(voiceLang);

  useEffect(() => {
    if (!rideId) return;
    getRide(rideId)
      .then(setRide)
      .catch(() => toast.error("Couldn't load this trip"));
  }, [rideId]);

  useEffect(() => {
    if (statusUpdate) setRide((prev) => (prev ? { ...prev, status: statusUpdate.status } : prev));
  }, [statusUpdate]);

  useRideLocationPush(rideId, !!ride && ACTIVE_STATUSES.includes(ride.status));

  const preArrival = ride ? ride.status === "accepted" || ride.status === "arriving" : false;
  const target = ride ? (preArrival ? { lat: ride.pickupLat, lng: ride.pickupLng } : { lat: ride.destinationLat, lng: ride.destinationLng }) : null;

  // Recompute the route only when the leg target changes, not on every GPS tick.
  useEffect(() => {
    if (!position || !target || !ride) return;
    const leg = preArrival ? "pickup" : "destination";
    if (legRef.current === leg) return;
    legRef.current = leg;
    setStepIndex(0);
    lastSpokenStepRef.current = -1;
    computeRoute(position, target, "DRIVING", GOOGLE_KEY).then(setRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, position?.lat, position?.lng]);

  const live = useMemo(() => {
    if (!position || !route) return null;
    const steps = route.steps;
    const idx = Math.min(stepIndex, steps.length - 1);
    const step = steps[idx];
    if (!step) return null;
    const distToStepEnd = haversineMeters(position.lat, position.lng, step.endLat, step.endLng);
    const remainingSteps = steps.slice(idx + 1).reduce((sum, s) => sum + s.distanceMeters, 0);
    const remainingDistanceMeters = distToStepEnd + remainingSteps;
    const avgSpeed = route.distanceMeters / Math.max(1, route.durationSeconds);
    const remainingDurationSeconds = remainingDistanceMeters / Math.max(0.3, avgSpeed);
    return { instruction: step.instruction, distToStepEnd, remainingDistanceMeters, remainingDurationSeconds, stepIdx: idx };
  }, [position, route, stepIndex]);

  useEffect(() => {
    if (!live || !route) return;
    if (live.distToStepEnd < 20 && stepIndex < route.steps.length - 1) setStepIndex((i) => i + 1);
  }, [live, route, stepIndex]);

  useEffect(() => {
    if (!live || !voiceOn) return;
    if (live.stepIdx !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = live.stepIdx;
      speak(`${live.instruction}`, { force: true });
    }
  }, [live, voiceOn, speak]);

  const handleArrived = async () => {
    if (!rideId) return;
    setActionPending(true);
    try {
      await signalRideArrived(rideId);
    } catch {
      toast.error("Couldn't update status");
    } finally {
      setActionPending(false);
    }
  };

  const handleStart = async () => {
    if (!rideId) return;
    setActionPending(true);
    try {
      await startRide(rideId);
      legRef.current = null;
    } catch {
      toast.error("Couldn't start the trip");
    } finally {
      setActionPending(false);
    }
  };

  const handleComplete = async () => {
    if (!rideId) return;
    setActionPending(true);
    try {
      await completeRide(rideId);
      router.replace("/driver");
    } catch {
      toast.error("Couldn't complete the trip");
    } finally {
      setActionPending(false);
    }
  };

  if (!ready || !ride) return null;

  const speedKmh = position?.speed != null ? position.speed * 3.6 : null;

  return (
    <div className="relative h-full w-full">
      <MapBase
        me={position}
        follow
        routePoints={route?.polylinePoints ?? []}
        markers={[
          preArrival
            ? { id: "pickup", lat: ride.pickupLat, lng: ride.pickupLng, label: "Pickup", color: "#16A34A" }
            : { id: "dest", lat: ride.destinationLat, lng: ride.destinationLng, label: "Destination", color: "#DC2626" },
        ]}
        initialCenter={position ?? target ?? undefined}
      />

      {live && (
        <NavigationHud
          mode="road"
          instruction={live.instruction}
          distanceToStepMeters={live.distToStepEnd}
          remainingDistanceMeters={live.remainingDistanceMeters}
          remainingDurationSeconds={live.remainingDurationSeconds}
          arrivalTime={new Date(Date.now() + live.remainingDurationSeconds * 1000)}
          speedKmh={speedKmh}
          confidence="high"
          voiceOn={voiceOn}
          voiceAvailable
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onCancel={() => router.replace("/driver")}
        />
      )}

      {/* Stacked above NavigationHud's own bottom stat bar (flush at the
          screen bottom) so the two floating cards don't overlap. */}
      <div className={`absolute inset-x-4 z-30 ${live ? "bottom-[calc(env(safe-area-inset-bottom,0px)+13rem)]" : "bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"}`}>
        <div className="rounded-3xl bg-card p-5 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {preArrival ? "Picking up" : "Dropping off"}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="truncate text-base font-extrabold text-foreground">
              {ride.rider?.fullName ?? "Rider"}
            </p>
            {ride.rider?.phoneNumber && (
              <a
                href={`tel:${ride.rider.phoneNumber}`}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95 transition-transform"
                aria-label="Call rider"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>

          {ride.status === "accepted" || ride.status === "arriving" ? (
            <button
              onClick={handleArrived}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              I&apos;ve arrived
            </button>
          ) : ride.status === "arrived" ? (
            <button
              onClick={handleStart}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              Start trip
            </button>
          ) : ride.status === "started" ? (
            <button
              onClick={handleComplete}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              Complete trip
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
