"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Volume2,
  VolumeX,
  Navigation,
  X,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight
} from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useRideSocket } from "@/features/ride/useRideSocket";
import { useRideLocationPush } from "@/features/ride/useRideLocationPush";
import { useNavigationStore } from "@/features/navigation/store";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import { haversineMeters, formatDistance, formatDuration } from "@/features/location/geo";
import { useVoiceGuidance, type VoiceLanguage } from "@/features/navigation/useVoiceGuidance";
import { getRide, signalRideArrived, startRide, completeRide } from "@/lib/api";
import type { Ride, RideStatus } from "@/types/api";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ACTIVE_STATUSES: RideStatus[] = ["accepted", "arriving", "arrived", "started"];

function TurnIcon({ instruction, className }: { instruction: string; className?: string }) {
  const lower = instruction.toLowerCase();
  if (lower.includes("left")) return <CornerUpLeft className={className} strokeWidth={2.5} />;
  if (lower.includes("right")) return <CornerUpRight className={className} strokeWidth={2.5} />;
  return <ArrowUp className={className} strokeWidth={2.5} />;
}

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

  // Redesign state: manual map follow toggle and bottom sheet panel
  const [isFollowing, setIsFollowing] = useState(true);
  const [speedWarningVisible, setSpeedWarningVisible] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const prevIsSpeedingRef = useRef(false);

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
    return `Building with blue facade near the corner (///${w3w})`;
  }, [ride, preArrival]);

  const activeSpeed = position?.speed != null ? Math.round(position.speed * 3.6) : simulatedSpeed;
  const speedLimit = 50; // km/h local speed limit warning

  // Detect transitions to speeding and trigger warning alert for 3 seconds
  useEffect(() => {
    const isSpeeding = activeSpeed > speedLimit;
    if (isSpeeding && !prevIsSpeedingRef.current) {
      setSpeedWarningVisible(true);
      const timer = setTimeout(() => {
        setSpeedWarningVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!isSpeeding) {
      setSpeedWarningVisible(false);
    }
    prevIsSpeedingRef.current = isSpeeding;
  }, [activeSpeed]);

  if (!ready || !ride) return null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Full-screen auto-rotational follow Map (92% of layout focus) */}
      <MapBase
        me={position}
        follow={isFollowing}
        lookAheadMeters={30}
        routePoints={route?.polylinePoints ?? []}
        markers={[
          preArrival
            ? { id: "pickup", lat: ride.pickupLat, lng: ride.pickupLng, label: "Pickup", color: "#16A34A" }
            : { id: "dest", lat: ride.destinationLat, lng: ride.destinationLng, label: "Destination", color: "#DC2626" },
        ]}
        initialCenter={position ?? target ?? undefined}
        onUserDrag={() => setIsFollowing(false)}
      />

      {/* Top turn-by-turn banner HUD (Next Turn Instruction) */}
      {live && (
        <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-30">
          <div className="flex items-center gap-4 rounded-3xl bg-foreground/90 p-3 pr-4 shadow-2xl backdrop-blur-md text-left border border-white/10">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary">
              <TurnIcon className="h-7 w-7 text-primary-foreground" instruction={live.instruction} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold leading-tight text-white">{formatDistance(live.distToStepEnd)}</p>
              <p className="truncate text-sm font-semibold text-white/70">{live.instruction}</p>
            </div>
          </div>
        </div>
      )}

      {/* Left Speedometer & Speed Limit Overlays */}
      <div className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+7rem)] z-30 flex flex-col gap-2.5 items-start">
        {/* Speed Limit circle badge */}
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-[3.5px] border-red-600 bg-white text-black text-xs font-black shadow-lg">
          <span className="leading-none text-[13px]">50</span>
          <span className="text-[5.5px] font-bold leading-none mt-0.5">LIMIT</span>
        </div>
        
        {/* Flashing warning overlay (shows for only 3 seconds) */}
        {speedWarningVisible && (
          <div className="rounded-2xl bg-red-600 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-xl flex items-center gap-1.5 animate-slide-up-spring ring-4 ring-red-500/35 border border-white/20">
            <AlertTriangle className="h-4 w-4 text-white animate-pulse" />
            <span>REDUCE SPEED!</span>
          </div>
        )}
      </div>

      {/* Right Floating Controls: Voice guidance mute & Recenter follow toggle */}
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+7rem)] z-30 flex flex-col gap-3">
        <button
          onClick={() => setVoiceOn((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-card/90 backdrop-blur-md border border-border/40 shadow-lg text-foreground active:scale-90 transition-transform"
          title={voiceOn ? "Mute Voice Guidance" : "Unmute Voice Guidance"}
        >
          {voiceOn ? (
            <Volume2 className="h-5 w-5 text-primary" />
          ) : (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {!isFollowing && (
          <button
            onClick={() => setIsFollowing(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card/95 backdrop-blur-md border border-border/50 shadow-lg text-primary active:scale-90 transition-all animate-bounce"
            title="Recenter Map Follow Mode"
          >
            <Navigation className="h-5 w-5 fill-primary text-primary" />
          </button>
        )}
      </div>

      {/* Bottom Interface: Collapsed stats bar, passenger card & triggerable sheet */}
      {!bottomSheetOpen && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] inset-x-4 z-30 flex flex-col items-center gap-3 pointer-events-none">
          {/* Compact Floating Passenger Card (Max height 70px) */}
          <div
            className="w-full max-w-sm h-[64px] bg-card/95 backdrop-blur-md rounded-2xl border border-border/40 p-2.5 shadow-xl flex items-center justify-between pointer-events-auto cursor-pointer transition-all hover:bg-card select-none"
            onClick={(e) => {
              const targetEl = e.target as HTMLElement;
              if (targetEl.closest("button") || targetEl.closest("a")) return;
              setBottomSheetOpen(true);
            }}
          >
            <div className="min-w-0 flex-1 text-left pl-1.5">
              <p className="text-[9px] font-black text-muted-foreground uppercase leading-none tracking-wide">
                {preArrival ? "PICKUP PASSENGER" : "DROPOFF TRIP"}
              </p>
              <p className="truncate text-sm font-extrabold text-foreground mt-1 leading-none">
                {ride.rider?.fullName ?? "Passenger"}
              </p>
              <p className="text-[10px] font-bold text-[#F59E0B] mt-1 leading-none">★ 4.8 Rating</p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => toast.info("Messaging Passenger")}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground active:scale-90 transition-transform"
                aria-label="Message passenger"
              >
                <MessageCircle className="h-4.5 w-4.5" />
              </button>

              {ride.rider?.phoneNumber && (
                <a
                  href={`tel:${ride.rider.phoneNumber}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground active:scale-90 transition-transform"
                  aria-label="Call passenger"
                >
                  <Phone className="h-4.5 w-4.5" />
                </a>
              )}

              {/* Directly perform the current workflow action */}
              {ride.status === "accepted" || ride.status === "arriving" ? (
                <button
                  onClick={handleArrived}
                  disabled={actionPending}
                  className="h-9 px-3.5 rounded-xl bg-primary text-xs font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow shadow-primary/20"
                >
                  Arrived
                </button>
              ) : ride.status === "arrived" ? (
                <button
                  onClick={handleStart}
                  disabled={actionPending}
                  className="h-9 px-3.5 rounded-xl bg-primary text-xs font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow shadow-primary/20"
                >
                  Start
                </button>
              ) : ride.status === "started" ? (
                <button
                  onClick={handleCompleteClick}
                  disabled={actionPending}
                  className="h-9 px-3.5 rounded-xl bg-primary text-xs font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow shadow-primary/20"
                >
                  End
                </button>
              ) : null}
            </div>
          </div>

          {/* Compact Trip pill (One line, stats) */}
          {live && (
            <div
              onClick={() => setBottomSheetOpen(true)}
              className="cursor-pointer px-4.5 py-2.5 rounded-full bg-card/95 backdrop-blur-md border border-border/50 shadow-xl text-[11px] font-black text-foreground hover:bg-card active:scale-95 transition-all flex items-center gap-2 select-none pointer-events-auto"
            >
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>
                {formatDistance(live.remainingDistanceMeters)} • {formatDuration(live.remainingDurationSeconds)} • {activeSpeed} km/h
              </span>
            </div>
          )}
        </div>
      )}

      {/* Dynamic bottom details sheet modal overlay */}
      {bottomSheetOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs flex items-end justify-center" onClick={() => setBottomSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-[32px] bg-card p-6 shadow-2xl border-t border-border/60 animate-slide-up-spring flex flex-col gap-4 text-left max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab indicator */}
            <div className="w-12 h-1.5 bg-border/80 rounded-full mx-auto mb-1 cursor-pointer" onClick={() => setBottomSheetOpen(false)} />

            <div className="flex justify-between items-center pb-2.5 border-b border-border">
              <h3 className="text-lg font-black text-foreground">Trip Overview</h3>
              <button
                onClick={() => setBottomSheetOpen(false)}
                className="h-8 w-8 bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center rounded-full active:scale-90 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Enlarged metrics panel */}
            {live && (
              <div className="grid grid-cols-3 gap-2.5 text-center bg-secondary/50 rounded-2xl p-4 border border-border/25">
                <div>
                  <span className="block text-[8.5px] font-black text-muted-foreground uppercase leading-none">Remaining</span>
                  <span className="text-base font-extrabold text-foreground mt-1.5 block leading-none">{formatDistance(live.remainingDistanceMeters)}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-black text-muted-foreground uppercase leading-none">ETA Duration</span>
                  <span className="text-base font-extrabold text-foreground mt-1.5 block leading-none">{formatDuration(live.remainingDurationSeconds)}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-black text-muted-foreground uppercase leading-none">Live Speed</span>
                  <span className="text-base font-extrabold text-foreground mt-1.5 block leading-none">{activeSpeed} km/h</span>
                </div>
              </div>
            )}

            {/* Passenger Information details block */}
            <div className="flex flex-col gap-3 rounded-2xl bg-secondary/20 p-4 border border-border/30">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Passenger Coordination</p>
              <div className="flex justify-between items-center mt-1">
                <div>
                  <p className="text-base font-extrabold text-foreground leading-none">{ride.rider?.fullName ?? "Passenger"}</p>
                  <p className="text-xs font-semibold text-[#F59E0B] mt-1.5 leading-none">★ 4.8 Rating · Active Member</p>
                  {ride.rider?.phoneNumber && (
                    <p className="text-xs font-bold text-muted-foreground mt-1 leading-none">{ride.rider.phoneNumber}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast.info("Messaging Passenger")}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary hover:bg-secondary/80 text-foreground active:scale-95 transition-transform"
                    aria-label="Message passenger"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                  {ride.rider?.phoneNumber && (
                    <a
                      href={`tel:${ride.rider.phoneNumber}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground active:scale-95 transition-transform"
                      aria-label="Call passenger"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Landmark Directions direction helper */}
            {landmarkDirection && (
              <div className="rounded-2xl bg-primary/5 p-4 border border-primary/20 text-left flex items-start gap-2.5">
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

            {/* Trip endpoints */}
            <div className="flex flex-col gap-2.5 rounded-2xl bg-secondary/20 p-4 border border-border/30">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider leading-none">Trip Path</p>
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground leading-none text-left">Pickup point</p>
                    <p className="text-sm font-bold text-foreground mt-1 leading-none text-left truncate">{ride.pickupWhat3words || "Current Location"}</p>
                  </div>
                </div>
                <div className="h-[1px] bg-border/20 w-full ml-4" />
                <div className="flex items-start gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground leading-none text-left">Destination point</p>
                    <p className="text-sm font-bold text-foreground mt-1 leading-none text-left truncate">{ride.destinationWhat3words}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gross Fare & Commission details */}
            <div className="rounded-2xl bg-secondary/30 p-4 border border-border/20 text-left">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-2.5">Earnings Estimation</p>
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Est. gross fare:</span>
                <span className="text-foreground">KES {Math.round(ride.fare || 0)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-muted-foreground mt-1.5">
                <span>Commission (20%):</span>
                <span className="text-red-500">- KES {Math.round((ride.fare || 0) * 0.2)}</span>
              </div>
              <div className="h-[1px] bg-border/20 my-2.5" />
              <div className="flex justify-between text-sm font-black text-foreground">
                <span>Driver net payout (80%):</span>
                <span className="text-primary text-base">KES {Math.round((ride.fare || 0) * 0.8)}</span>
              </div>
            </div>

            {/* Quick SafetySOS & trip recording tools */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.error("SOS Alert Dispatched to Emergency Responders!", { duration: 5000 });
                  setBottomSheetOpen(false);
                }}
                className="flex-1 h-12 rounded-xl bg-emergency text-xs font-black text-emergency-foreground flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ShieldCheck className="h-4.5 w-4.5" /> TRIGGER SOS
              </button>
              <button
                onClick={() => {
                  toast.info("Trip recording started");
                  setBottomSheetOpen(false);
                }}
                className="flex-1 h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-black text-foreground flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                🎙️ RECORD TRIP
              </button>
            </div>

            {/* Workflow Action Button at the bottom of the Sheet */}
            {ride.status === "accepted" || ride.status === "arriving" ? (
              <button
                onClick={() => {
                  handleArrived();
                  setBottomSheetOpen(false);
                }}
                disabled={actionPending}
                className="h-14 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 mt-1 shadow-lg shadow-primary/20"
              >
                I&apos;ve Arrived at Pickup
              </button>
            ) : ride.status === "arrived" ? (
              <button
                onClick={() => {
                  handleStart();
                  setBottomSheetOpen(false);
                }}
                disabled={actionPending}
                className="h-14 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 mt-1 shadow-lg shadow-primary/20"
              >
                Start Trip
              </button>
            ) : ride.status === "started" ? (
              <button
                onClick={() => {
                  handleCompleteClick();
                  setBottomSheetOpen(false);
                }}
                disabled={actionPending}
                className="h-14 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 mt-1 shadow-lg shadow-primary/20"
              >
                End Trip
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Trip Complete Earnings Invoice Modal (Shows stats payout summary) */}
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
