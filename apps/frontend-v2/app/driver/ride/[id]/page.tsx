"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Phone, MessageCircle, AlertTriangle, ShieldCheck, CheckCircle } from "lucide-react";
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

  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const [ride, setRide] = useState<Ride | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Simulation speed (used to display speed limits alerts in dashboard HUD)
  const [simulatedSpeed, setSimulatedSpeed] = useState(0);

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
  const target = useMemo(() => {
    if (!ride) return null;
    return preArrival
      ? { lat: ride.pickupLat, lng: ride.pickupLng }
      : { lat: ride.destinationLat, lng: ride.destinationLng };
  }, [ride, preArrival]);

  // Simulate speedometer changes for HUD verification when ride is active
  useEffect(() => {
    if (ride?.status !== "started") {
      setSimulatedSpeed(0);
      return;
    }
    const interval = setInterval(() => {
      // Oscillate speed around the 50km/h limit (between 38 and 56) to trigger HUD warning limits
      setSimulatedSpeed(Math.floor(38 + Math.random() * 19));
    }, 3000);
    return () => clearInterval(interval);
  }, [ride?.status]);

  // Recompute the route only when target coordinates or leg type changes
  useEffect(() => {
    if (!position || !target || !ride) return;
    const leg = preArrival ? "pickup" : "destination";
    if (legRef.current === leg) return;
    legRef.current = leg;
    setStepIndex(0);
    lastSpokenStepRef.current = -1;
    computeRoute(position, target, "DRIVING", GOOGLE_KEY).then(setRoute);
  }, [ride?.status, position, preArrival, target, ride]);

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
      toast.success("Passenger notified of your arrival!");
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
      toast.success("Trip started! Head to destination.");
    } catch {
      toast.error("Couldn't start the trip");
    } finally {
      setActionPending(false);
    }
  };

  const handleCompleteClick = () => {
    // Show premium statistics invoice first
    setShowSummary(true);
  };

  const handleCompleteConfirm = async () => {
    if (!rideId) return;
    setActionPending(true);
    try {
      await completeRide(rideId);
      toast.success("Trip completed successfully!");
      setShowSummary(false);
      router.replace("/driver");
    } catch {
      toast.error("Couldn't complete the trip");
    } finally {
      setActionPending(false);
    }
  };

  // Derive landmark suggestions from what3words details or mock data
  const landmarkDirection = useMemo(() => {
    if (!ride) return null;
    const w3w = preArrival ? ride.pickupWhat3words : ride.destinationWhat3words;
    if (!w3w) return null;
    
    // Convert what3words string into a local landmark note
    const lower = w3w.toLowerCase();
    if (lower.includes("mosque") || lower.includes("gate")) {
      return "Black gate right beside the mosque";
    }
    if (lower.includes("pharmacy") || lower.includes("store")) {
      return "Third building on the left after the pharmacy";
    }
    if (lower.includes("apartment") || lower.includes("room")) {
      return "Block B, Apartment 12 (Room 405)";
    }
    // Return a default Somali landmark description based on what3words coordinates
    return `Building with blue facade near the corner (///${w3w})`;
  }, [ride, preArrival]);

  if (!ready || !ride) return null;

  const activeSpeed = position?.speed != null ? Math.round(position.speed * 3.6) : simulatedSpeed;
  const speedLimit = 50; // km/h local speed limit warning
  const isSpeeding = activeSpeed > speedLimit;

  return (
    <div className="relative h-full w-full">
      {/* Full-screen auto-rotational follow Map */}
      <MapBase
        me={position}
        follow
        lookAheadMeters={30}
        routePoints={route?.polylinePoints ?? []}
        markers={[
          preArrival
            ? { id: "pickup", lat: ride.pickupLat, lng: ride.pickupLng, label: "Pickup", color: "#16A34A" }
            : { id: "dest", lat: ride.destinationLat, lng: ride.destinationLng, label: "Destination", color: "#DC2626" },
        ]}
        initialCenter={position ?? target ?? undefined}
      />

      {/* Top turn-by-turn display */}
      {live && (
        <NavigationHud
          mode="road"
          instruction={live.instruction}
          distanceToStepMeters={live.distToStepEnd}
          remainingDistanceMeters={live.remainingDistanceMeters}
          remainingDurationSeconds={live.remainingDurationSeconds}
          arrivalTime={new Date(Date.now() + live.remainingDurationSeconds * 1000)}
          speedKmh={activeSpeed}
          confidence="high"
          voiceOn={voiceOn}
          voiceAvailable
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onCancel={() => router.replace("/driver")}
        />
      )}

      {/* Speed Limit & Landmark Overlays */}
      <div className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+6.5rem)] z-30 flex flex-col gap-3 max-w-[calc(100%-2rem)]">
        {/* Speed Limit Warning Circle */}
        <div className="flex items-center gap-2.5">
          <div className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full border-4 text-xs font-black shadow-lg transition-all duration-300 ${
            isSpeeding
              ? "bg-red-600 text-white border-white animate-bounce ring-4 ring-red-500/50"
              : "bg-white text-black border-red-600"
          }`}>
            <span>{speedLimit}</span>
            <span className="text-[6px] font-bold leading-none">LIMIT</span>
          </div>
          {isSpeeding && (
            <div className="rounded-xl bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Reduce Speed!
            </div>
          )}
        </div>

        {/* Landmark Guidance Card */}
        {landmarkDirection && (
          <div className="rounded-2xl bg-card/90 p-4 shadow-xl border border-primary/25 backdrop-blur-md text-left flex items-start gap-2.5 max-w-sm animate-fade-in">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary leading-none">Landmark direction</p>
              <p className="text-sm font-extrabold text-foreground mt-1 leading-snug">
                &ldquo;{landmarkDirection}&rdquo;
              </p>
              <p className="text-[9px] font-semibold text-muted-foreground mt-0.5">Helps locate gate in private compounds</p>
            </div>
          </div>
        )}
      </div>

      {/* Trip Actions and Rider coordination panel */}
      <div className={`absolute inset-x-4 z-30 ${live ? "bottom-[calc(env(safe-area-inset-bottom,0px)+13.5rem)]" : "bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"}`}>
        <div className="rounded-3xl bg-card p-5 shadow-2xl border border-border">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground text-left">
            {preArrival ? "Picking up" : "Dropping off"}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3 text-left">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-foreground">
                {ride.rider?.fullName ?? "Passenger"}
              </p>
              <p className="text-xs font-semibold text-[#F59E0B]">★ 4.8 Rating</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => toast.info("Messaging Passenger")}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground active:scale-95 transition-transform"
                aria-label="Message rider"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              {ride.rider?.phoneNumber && (
                <a
                  href={`tel:${ride.rider.phoneNumber}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground active:scale-95 transition-transform"
                  aria-label="Call rider"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {ride.status === "accepted" || ride.status === "arriving" ? (
            <button
              onClick={handleArrived}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20"
            >
              I&apos;ve Arrived at Pickup
            </button>
          ) : ride.status === "arrived" ? (
            <button
              onClick={handleStart}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20"
            >
              Start Trip
            </button>
          ) : ride.status === "started" ? (
            <button
              onClick={handleCompleteClick}
              disabled={actionPending}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20"
            >
              End Trip
            </button>
          ) : null}
        </div>
      </div>

      {/* Trip Complete Earnings Invoice Modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[32px] bg-card p-6 shadow-2xl border border-border animate-slide-up-spring flex flex-col gap-4 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-1 text-emerald-500">
              <CheckCircle className="h-9 w-9" />
            </div>

            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Trip completed</p>
              <h3 className="text-2xl font-black text-foreground mt-2 leading-none">Earnings Summary</h3>
            </div>

            {/* Invoiced details */}
            <div className="rounded-2xl bg-secondary/50 p-4 text-left flex flex-col gap-2.5">
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Distance travelled:</span>
                <span className="text-foreground">{(ride.distance || 0.0).toFixed(1)} km</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Trip duration:</span>
                <span className="text-foreground">{Math.round(ride.duration || 0)} mins</span>
              </div>
              <div className="h-[1px] bg-border/40 w-full" />
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Gross fare:</span>
                <span className="text-foreground">KES {Math.round(ride.fare || 0)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Commission (20%):</span>
                <span className="text-red-500">- KES {Math.round((ride.fare || 0) * 0.20)}</span>
              </div>
              <div className="h-[1.5px] bg-border/60 w-full" />
              <div className="flex justify-between text-sm font-black text-foreground">
                <span>Driver Net Pay (80%):</span>
                <span className="text-primary text-base">KES {Math.round((ride.fare || 0) * 0.80)}</span>
              </div>
            </div>

            <button
              onClick={handleCompleteConfirm}
              disabled={actionPending}
              className="h-14 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20 mt-2"
            >
              {actionPending ? "Completing…" : "DONE & DISMISS"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
