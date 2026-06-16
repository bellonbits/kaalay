"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Footprints, Bike, Car, Compass, LocateFixed } from "lucide-react";
import MapBase from "@/components/shared/MapBase";
import NavigationHud from "@/features/navigation/components/NavigationHud";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore, type TravelMode } from "@/features/navigation/store";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import { bearing, haversineMeters, formatDistance, formatDuration } from "@/features/location/geo";
import { useVoiceGuidance, type VoiceLanguage } from "@/features/navigation/useVoiceGuidance";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const ROAD_MODES: { mode: TravelMode; label: string; icon: typeof Footprints }[] = [
  { mode: "WALKING", label: "Walking", icon: Footprints },
  { mode: "BICYCLING", label: "Bike", icon: Bike },
  { mode: "DRIVING", label: "Car", icon: Car },
];

type Estimate = { distanceMeters: number; durationSeconds: number } | "loading" | "unavailable";

export default function RoutePage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.position);
  const destination = useNavigationStore((s) => s.destination);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setImmersive = useNavigationStore((s) => s.setImmersive);
  const autoStart = useNavigationStore((s) => s.autoStart);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);

  const [phase, setPhase] = useState<"select" | "navigating" | "arrived">("select");
  const [selectedMode, setSelectedMode] = useState<TravelMode>("WALKING");
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [manualPan, setManualPan] = useState(false);

  const approachedRef = useRef(false);
  const lastSpokenStepRef = useRef(-1);

  const voiceLang: VoiceLanguage =
    (typeof window !== "undefined" && (localStorage.getItem("kaalay_voice_lang") as VoiceLanguage)) || "en";
  const { speak, matchedRequestedLanguage } = useVoiceGuidance(voiceLang);

  // Redirect home if this screen was reached without a destination chosen.
  useEffect(() => {
    if (ready && !destination) router.replace("/navigate");
  }, [ready, destination, router]);

  // Fetch all three road-mode estimates in parallel as soon as we have a fix.
  useEffect(() => {
    if (!position || !destination) return;
    let cancelled = false;
    setEstimates(Object.fromEntries(ROAD_MODES.map((m) => [m.mode, "loading" as const])));

    Promise.all(
      ROAD_MODES.map(async ({ mode }) => {
        const result = await computeRoute(position, destination, mode as "WALKING" | "BICYCLING" | "DRIVING", GOOGLE_KEY);
        return [mode, result] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const nextEstimates: Record<string, Estimate> = {};
      const nextRoutes: Record<string, RouteResult> = {};
      let anyAvailable = false;
      for (const [mode, result] of results) {
        if (result) {
          nextEstimates[mode] = { distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
          nextRoutes[mode] = result;
          anyAvailable = true;
        } else {
          nextEstimates[mode] = "unavailable";
        }
      }
      setEstimates(nextEstimates);
      setRoutes(nextRoutes);

      const firstAvailable = ROAD_MODES.find((m) => nextRoutes[m.mode])?.mode ?? "PRECISION";
      // No road route anywhere — silently fall back to precision, no error
      // shown, no dead end, per spec.
      if (!anyAvailable) setSelectedMode("PRECISION");
      else setSelectedMode(firstAvailable);

      if (autoStart) {
        setAutoStart(false);
        startNavigation(firstAvailable, firstAvailable === "PRECISION" ? null : nextRoutes[firstAvailable]);
      }
    });

    return () => {
      cancelled = true;
    };
    // Only recompute when the destination changes, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng]);

  const startNavigation = (mode: TravelMode, route: RouteResult | null) => {
    setSelectedMode(mode);
    setActiveRoute(mode === "PRECISION" ? null : route);
    approachedRef.current = false;
    lastSpokenStepRef.current = -1;
    setStepIndex(0);
    setManualPan(false);
    setPhase("navigating");
  };

  const handleGo = () => startNavigation(selectedMode, selectedMode === "PRECISION" ? null : routes[selectedMode] ?? null);

  useEffect(() => {
    setImmersive(phase === "navigating" || phase === "arrived");
    return () => setImmersive(false);
  }, [phase, setImmersive]);

  // ── Live navigation math ─────────────────────────────────────────────
  const isRoad = selectedMode !== "PRECISION" && !!activeRoute;

  const live = useMemo(() => {
    if (!position || !destination) return null;

    if (isRoad && activeRoute) {
      const steps = activeRoute.steps;
      const idx = Math.min(stepIndex, steps.length - 1);
      const step = steps[idx];
      if (!step) return null;
      const distToStepEnd = haversineMeters(position.lat, position.lng, step.endLat, step.endLng);
      const remainingSteps = steps.slice(idx + 1).reduce((sum, s) => sum + s.distanceMeters, 0);
      const remainingDistanceMeters = distToStepEnd + remainingSteps;
      const avgSpeed = activeRoute.distanceMeters / Math.max(1, activeRoute.durationSeconds); // m/s
      const remainingDurationSeconds = remainingDistanceMeters / Math.max(0.3, avgSpeed);
      return {
        mode: "road" as const,
        instruction: step.instruction,
        distanceToStepMeters: distToStepEnd,
        remainingDistanceMeters,
        remainingDurationSeconds,
        stepIdx: idx,
        distToStepEnd,
      };
    }

    const remainingDistanceMeters = haversineMeters(position.lat, position.lng, destination.lat, destination.lng);
    const bearingDeg = bearing(position.lat, position.lng, destination.lat, destination.lng);
    return { mode: "precision" as const, remainingDistanceMeters, bearingDeg };
  }, [position, destination, isRoad, activeRoute, stepIndex]);

  // Step auto-advance (road mode) — within 20m of a step's end, move to the next one.
  useEffect(() => {
    if (!live || live.mode !== "road" || !activeRoute) return;
    if (live.distToStepEnd < 20 && stepIndex < activeRoute.steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [live, activeRoute, stepIndex]);

  // Voice guidance + arrival detection
  useEffect(() => {
    if (!live || phase !== "navigating") return;

    if (live.remainingDistanceMeters < 15) {
      setPhase("arrived");
      speak("You have arrived.", { force: true });
      return;
    }
    if (live.remainingDistanceMeters < 50 && !approachedRef.current) {
      approachedRef.current = true;
      speak("You are approaching your destination.", { force: true });
    }
    if (live.mode === "road" && live.stepIdx !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = live.stepIdx;
      if (voiceOn) speak(`${live.instruction}, for ${formatDistance(live.distanceToStepMeters)}`, { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase, voiceOn]);

  const handleCancel = () => {
    setPhase("select");
    setActiveRoute(null);
  };

  const handleClose = () => {
    setDestination(null);
    router.replace("/navigate");
  };

  if (!ready || !destination) return null;

  const speedKmh = position?.speed != null ? position.speed * 3.6 : null;

  return (
    <div className="relative h-full w-full">
      <MapBase
        me={position}
        follow={phase === "navigating" && !manualPan}
        onUserDrag={() => setManualPan(true)}
        showGrid
        routePoints={isRoad && activeRoute ? activeRoute.polylinePoints : []}
        markers={[{ id: "dest", lat: destination.lat, lng: destination.lng, label: destination.label, color: "#DC2626" }]}
        initialCenter={position ?? destination}
      />

      {phase === "navigating" && manualPan && (
        <button
          onClick={() => setManualPan(false)}
          aria-label="Re-center on my location"
          className="absolute right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg active:scale-95 transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 13rem)" }}
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
      )}

      {phase === "select" && (
        <div className="absolute inset-0 z-20 flex flex-col">
          <button
            onClick={() => router.push("/navigate")}
            className="m-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>

          <div className="mt-auto rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Destination</p>
            <p className="mt-1 truncate text-lg font-extrabold text-foreground">{destination.label}</p>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {ROAD_MODES.map(({ mode, label, icon: Icon }) => {
                const est = estimates[mode];
                const unavailable = est === "unavailable";
                const active = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    disabled={unavailable}
                    onClick={() => setSelectedMode(mode)}
                    className={`flex h-24 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-all disabled:opacity-40 ${
                      active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                    <span className="text-[10px] font-semibold opacity-80">
                      {est === "loading" ? "…" : est === "unavailable" || !est ? "N/A" : formatDuration(est.durationSeconds)}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedMode("PRECISION")}
                className={`flex h-24 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-all ${
                  selectedMode === "PRECISION" ? "bg-emergency text-emergency-foreground" : "bg-secondary text-foreground"
                }`}
              >
                <Compass className="h-5 w-5" />
                Precision
                <span className="text-[10px] font-semibold opacity-80">Compass</span>
              </button>
            </div>

            <button
              onClick={handleGo}
              disabled={selectedMode !== "PRECISION" && !routes[selectedMode]}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              GO
            </button>
          </div>
        </div>
      )}

      {phase === "navigating" && live && (
        <NavigationHud
          {...(live.mode === "road"
            ? {
                mode: "road" as const,
                instruction: live.instruction,
                distanceToStepMeters: live.distanceToStepMeters,
                remainingDistanceMeters: live.remainingDistanceMeters,
                remainingDurationSeconds: live.remainingDurationSeconds,
                arrivalTime: new Date(Date.now() + live.remainingDurationSeconds * 1000),
                confidence: "high" as const,
              }
            : {
                mode: "precision" as const,
                bearingDeg: live.bearingDeg,
                remainingDistanceMeters: live.remainingDistanceMeters,
                destinationLabel: destination.label,
              })}
          speedKmh={speedKmh}
          voiceOn={voiceOn}
          voiceAvailable={matchedRequestedLanguage}
          onToggleVoice={() => setVoiceOn((v) => !v)}
          onCancel={handleCancel}
        />
      )}

      {phase === "arrived" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-background/95 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
            <Check className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-foreground">You have arrived</h2>
            <p className="mt-2 text-base font-medium text-muted-foreground">{destination.label}</p>
          </div>
          <button
            onClick={handleClose}
            className="h-14 w-full max-w-xs rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
