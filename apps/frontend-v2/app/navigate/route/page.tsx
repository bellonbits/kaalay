"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Footprints,
  Bike,
  Car,
  LocateFixed,
  Share2,
  MapPin,
  TriangleAlert,
  X,
  ShieldAlert,
  Search,
  Bookmark,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import NavigationHud from "@/features/navigation/components/NavigationHud";
import DestinationSearch from "@/features/navigation/components/DestinationSearch";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore, type TravelMode } from "@/features/navigation/store";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import { bearing, haversineMeters, formatDistance, formatDuration, distanceToPolyline } from "@/features/location/geo";
import { useVoiceGuidance, type VoiceLanguage } from "@/features/navigation/useVoiceGuidance";
import { getNearbyRoadReports, getPlaceNotes, getWeather, convertToWords, getPlaces } from "@/lib/api";
import { weatherIcon } from "@/features/weather/weatherIcon";
import WeatherDetailsModal from "@/features/weather/components/WeatherDetailsModal";
import { NOTE_KIND_LABEL, NOTE_KIND_ORDER } from "@/features/navigation/noteKinds";
import type { RoadReport, PlaceNote, WeatherInfo, Place } from "@/types/api";
import type { LocationPoint, DetailPlace } from "@/features/navigation/types";

const ROAD_ISSUE_LABEL: Record<RoadReport["type"], string> = {
  blocked: "Road blocked",
  flooded: "Flooded",
  construction: "Construction",
  accident: "Accident",
  other: "Road issue",
};

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const ROAD_MODES: { mode: TravelMode; label: string; icon: typeof Footprints }[] = [
  { mode: "WALKING", label: "Walking", icon: Footprints },
  { mode: "TWO_WHEELER", label: "Motorcycle", icon: Bike },
  { mode: "DRIVING", label: "Car", icon: Car },
];

const BASE_SPEEDS_MPS: Record<TravelMode, number> = {
  WALKING: 1.4,
  TWO_WHEELER: 8.3,
  DRIVING: 13.8,
};

type Estimate = { distanceMeters: number; durationSeconds: number } | "loading" | "unavailable";

export default function RoutePage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  // Road-snapped when on a road (see useRoadSnap) — falls back to raw GPS off-road.
  const position = useLocationStore((s) => s.displayPosition);
  const destination = useNavigationStore((s) => s.destination);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const customOrigin = useNavigationStore((s) => s.origin);
  const setCustomOrigin = useNavigationStore((s) => s.setOrigin);
  const setImmersive = useNavigationStore((s) => s.setImmersive);
  const autoStart = useNavigationStore((s) => s.autoStart);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);
  const setLastCompletedRoute = useNavigationStore((s) => s.setLastCompletedRoute);
  const lastCompletedRoute = useNavigationStore((s) => s.lastCompletedRoute);

  const [phase, setPhase] = useState<"select" | "navigating" | "preview" | "arrived">("select");
  const [selectedMode, setSelectedMode] = useState<TravelMode>("WALKING");
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [manualPan, setManualPan] = useState(false);
  const [roadReports, setRoadReports] = useState<RoadReport[]>([]);
  const [placeNotes, setPlaceNotes] = useState<PlaceNote[]>([]);
  const [destinationWeather, setDestinationWeather] = useState<WeatherInfo | null>({
    tempC: 28,
    feelsLikeC: 30,
    condition: "Clear",
    description: "sunny and clear",
    humidity: 60,
    windKph: 12.0,
    cityName: "Mogadishu",
  });
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [originSearchOpen, setOriginSearchOpen] = useState(false);
  const [originMenuOpen, setOriginMenuOpen] = useState(false);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [originPinDraft, setOriginPinDraft] = useState<LocationPoint | null>(null);
  const [resolvingOriginPin, setResolvingOriginPin] = useState(false);

  // Simulation states
  const [simulating, setSimulating] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(5); // default 5x
  const [simulatedPaused, setSimulatedPaused] = useState(false);
  const [simulatedPosition, setSimulatedPosition] = useState<{ lat: number; lng: number; heading?: number; accuracy?: number } | null>(null);

  const origin = customOrigin ?? position;

  // A custom "From" that's actually close to where the device really is
  // (or no custom From at all) still gets real live GPS tracking. A custom
  // From meaningfully far away can only ever be a route preview — there's
  // no honest way to "live track" a route the device isn't physically on.
  const usingLiveGps = !customOrigin || (!!position && haversineMeters(customOrigin.lat, customOrigin.lng, position.lat, position.lng) < 300);

  const activePosition = simulating && simulatedPosition ? simulatedPosition : position;

  const approachedRef = useRef(false);
  const lastSpokenStepRef = useRef(-1);
  const offRouteStreakRef = useRef(0);
  const reroutingRef = useRef(false);
  const lastResolvedPinRef = useRef<string | null>(null);
  const pinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRoad = !!activeRoute;

  const simulationPoints = useMemo(() => {
    if (isRoad && activeRoute) {
      return activeRoute.polylinePoints;
    }
    if (origin && destination) {
      return [origin, destination];
    }
    return [];
  }, [isRoad, activeRoute, origin, destination]);

  const cumulativeDistances = useMemo(() => {
    if (simulationPoints.length === 0) return [];
    const dists = [0];
    for (let i = 1; i < simulationPoints.length; i++) {
      dists.push(
        dists[i - 1] +
          haversineMeters(
            simulationPoints[i - 1].lat,
            simulationPoints[i - 1].lng,
            simulationPoints[i].lat,
            simulationPoints[i].lng
          )
      );
    }
    return dists;
  }, [simulationPoints]);

  useEffect(() => {
    if (!simulating || simulatedPaused || cumulativeDistances.length === 0 || phase !== "navigating") {
      return;
    }

    const pts = simulationPoints;
    const totalDist = cumulativeDistances[cumulativeDistances.length - 1];
    if (totalDist <= 0) return;

    const baseSpeed = BASE_SPEEDS_MPS[selectedMode] ?? 1.4;
    const speedMps = baseSpeed * simulationSpeed;
    const intervalMs = 100;

    const interval = setInterval(() => {
      setSimulatedDistance((prev) => {
        const nextDist = prev + speedMps * (intervalMs / 1000);
        if (nextDist >= totalDist) {
          clearInterval(interval);
          setPhase("arrived");
          setSimulating(false);
          return totalDist;
        }

        let idx = 0;
        while (idx < cumulativeDistances.length - 1 && cumulativeDistances[idx + 1] < nextDist) {
          idx++;
        }

        const p1 = pts[idx];
        const p2 = pts[idx + 1] ?? p1;
        const segmentDist = cumulativeDistances[idx + 1] - cumulativeDistances[idx];

        let lat = p1.lat;
        let lng = p1.lng;
        let heading = 0;

        if (segmentDist > 0) {
          const ratio = (nextDist - cumulativeDistances[idx]) / segmentDist;
          lat = p1.lat + ratio * (p2.lat - p1.lat);
          lng = p1.lng + ratio * (p2.lng - p1.lng);
          heading = bearing(p1.lat, p1.lng, p2.lat, p2.lng);
        } else if (pts[idx + 1]) {
          heading = bearing(p1.lat, p1.lng, p2.lat, p2.lng);
        }

        setSimulatedPosition({
          lat,
          lng,
          heading,
          accuracy: 10,
        });

        return nextDist;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [simulating, simulatedPaused, simulationPoints, cumulativeDistances, simulationSpeed, selectedMode, phase]);

  const voiceLang: VoiceLanguage =
    (typeof window !== "undefined" && (localStorage.getItem("kaalay_voice_lang") as VoiceLanguage)) || "en";
  const { speak, matchedRequestedLanguage } = useVoiceGuidance(voiceLang);

  // Redirect home if this screen was reached without a destination chosen.
  useEffect(() => {
    if (ready && !destination) router.replace("/navigate");
  }, [ready, destination, router]);

  useEffect(() => {
    if (!destination) return;
    getNearbyRoadReports(destination.lat, destination.lng, 5)
      .then(setRoadReports)
      .catch(() => {});
    getWeather(destination.lat, destination.lng)
      .then(setDestinationWeather)
      .catch(() => {
        setDestinationWeather({
          tempC: 28,
          feelsLikeC: 30,
          condition: "Clear",
          description: "sunny and clear",
          humidity: 60,
          windKph: 12.0,
          cityName: "Mogadishu",
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!destination?.placeId) {
      setPlaceNotes([]);
      return;
    }
    getPlaceNotes(destination.placeId).then(setPlaceNotes).catch(() => {});
  }, [destination?.placeId]);

  // Fetch all three road-mode estimates in parallel as soon as we have a fix.
  useEffect(() => {
    if (!origin || !destination) return;
    let cancelled = false;
    setEstimates(Object.fromEntries(ROAD_MODES.map((m) => [m.mode, "loading" as const])));

    Promise.all(
      ROAD_MODES.map(async ({ mode }) => {
        const result = await computeRoute(origin, destination, mode as "WALKING" | "TWO_WHEELER" | "DRIVING", GOOGLE_KEY);
        return [mode, result] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const nextEstimates: Record<string, Estimate> = {};
      const nextRoutes: Record<string, RouteResult> = {};
      for (const [mode, result] of results) {
        if (result) {
          nextEstimates[mode] = { distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds };
          nextRoutes[mode] = result;
        } else {
          nextEstimates[mode] = "unavailable";
        }
      }
      setEstimates(nextEstimates);
      setRoutes(nextRoutes);

      const firstAvailable = ROAD_MODES.find((m) => nextRoutes[m.mode])?.mode ?? "WALKING";
      setSelectedMode(firstAvailable);

      if (autoStart) {
        setAutoStart(false);
        startNavigation(
          firstAvailable,
          nextRoutes[firstAvailable] ?? null,
          usingLiveGps ? "navigating" : "preview"
        );
      }
    });

    return () => {
      cancelled = true;
    };
    // Only recompute when the destination or an explicitly-set origin changes —
    // not on every GPS tick (origin falls back to live position via closure).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.lat, destination?.lng, customOrigin?.lat, customOrigin?.lng]);

  const startNavigation = (mode: TravelMode, route: RouteResult | null, targetPhase: "navigating" | "preview" = "navigating") => {
    setSelectedMode(mode);
    setActiveRoute(route);
    approachedRef.current = false;
    lastSpokenStepRef.current = -1;
    offRouteStreakRef.current = 0;
    setStepIndex(0);
    setManualPan(false);
    setPhase(targetPhase);
  };

  const handleGo = () =>
    startNavigation(selectedMode, routes[selectedMode] ?? null, usingLiveGps ? "navigating" : "preview");

  const handleStartSimulation = () => {
    const route = routes[selectedMode] ?? null;
    setSelectedMode(selectedMode);
    setActiveRoute(route);
    approachedRef.current = false;
    lastSpokenStepRef.current = -1;
    offRouteStreakRef.current = 0;
    setStepIndex(0);
    setManualPan(false);

    // Initialize simulation
    const startPoint = customOrigin ?? position ?? destination;
    const pts = route ? route.polylinePoints : [startPoint, destination];
    if (pts.length > 0 && pts[0]) {
      const p = pts[0];
      const p2 = pts[1] ?? p;
      if (p && p2) {
        setSimulatedPosition({
          lat: p.lat,
          lng: p.lng,
          heading: bearing(p.lat, p.lng, p2.lat, p2.lng),
          accuracy: 10,
        });
      } else {
        setSimulatedPosition(null);
      }
    } else {
      setSimulatedPosition(null);
    }
    setSimulatedDistance(0);
    setSimulatedPaused(false);
    setSimulating(true);
    setPhase("navigating");
  };

  const handleUseCurrentLocation = () => {
    setCustomOrigin(null);
    setPhase("select");
  };

  const handleOriginSelect = (point: LocationPoint) => {
    setCustomOrigin(point);
    setOriginSearchOpen(false);
  };

  const handleOriginPlaceSelect = (place: DetailPlace) => {
    handleOriginSelect({
      lat: place.lat,
      lng: place.lng,
      label: place.name,
      words: place.words,
      placeId: place.source === "kaalay" ? place.id : undefined,
    });
  };

  const openOriginMenu = () => setOriginMenuOpen(true);

  const handleOriginMenuSearch = () => {
    setOriginMenuOpen(false);
    setOriginSearchOpen(true);
  };

  const handleOriginMenuCurrentLocation = () => {
    setOriginMenuOpen(false);
    setCustomOrigin(null);
  };

  const handleOriginMenuSaved = () => {
    setOriginMenuOpen(false);
    setSavedPlacesOpen(true);
    getPlaces().then(setSavedPlaces).catch(() => {});
  };

  const handleSavedPlaceSelect = (p: Place) => {
    setCustomOrigin({ lat: p.latitude, lng: p.longitude, label: p.name, words: p.words, placeId: p.id });
    setSavedPlacesOpen(false);
  };

  const handleOriginMenuDropPin = () => {
    setOriginMenuOpen(false);
    lastResolvedPinRef.current = null;
    setOriginPinDraft(customOrigin ?? (position ? { lat: position.lat, lng: position.lng, label: "Locating…" } : null));
    setPickingOrigin(true);
  };

  const handlePinCenterChange = (lat: number, lng: number) => {
    setOriginPinDraft((prev) => ({ lat, lng, label: prev?.label ?? "Locating…" }));
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current);
    pinDebounceRef.current = setTimeout(async () => {
      if (key === lastResolvedPinRef.current) return;
      setResolvingOriginPin(true);
      try {
        const res = await convertToWords(lat, lng);
        lastResolvedPinRef.current = key;
        setOriginPinDraft({ lat, lng, label: res.words, words: res.words });
      } catch {
        setOriginPinDraft({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } finally {
        setResolvingOriginPin(false);
      }
    }, 450);
  };

  const confirmOriginPin = () => {
    if (!originPinDraft) return;
    setCustomOrigin(originPinDraft);
    setPickingOrigin(false);
  };

  useEffect(() => {
    setImmersive(phase === "navigating" || phase === "arrived");
    return () => setImmersive(false);
  }, [phase, setImmersive]);

  // ── Live navigation math ─────────────────────────────────────────────
  const live = useMemo(() => {
    if (!activePosition || !destination) return null;

    if (isRoad && activeRoute) {
      const steps = activeRoute.steps;
      const idx = Math.min(stepIndex, steps.length - 1);
      const step = steps[idx];
      if (!step) return null;
      const distToStepEnd = haversineMeters(activePosition.lat, activePosition.lng, step.endLat, step.endLng);
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

    const remainingDistanceMeters = haversineMeters(activePosition.lat, activePosition.lng, destination.lat, destination.lng);
    const bearingDeg = bearing(activePosition.lat, activePosition.lng, destination.lat, destination.lng);
    return { mode: "precision" as const, remainingDistanceMeters, bearingDeg };
  }, [activePosition, destination, isRoad, activeRoute, stepIndex]);

  // Step auto-advance (road mode) — within 20m of a step's end, move to the next one.
  useEffect(() => {
    if (!live || live.mode !== "road" || !activeRoute) return;
    if (live.distToStepEnd < 20 && stepIndex < activeRoute.steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [live, activeRoute, stepIndex]);

  // Auto-reroute on deviation — if the live GPS fix sits more than 40m off
  // the active polyline for 3 consecutive ticks (filters out single noisy
  // fixes), recompute the route fresh from the current position.
  useEffect(() => {
    if (phase !== "navigating" || simulating || !isRoad || !activeRoute || !position || !destination || reroutingRef.current) {
      return;
    }
    const offRoute = distanceToPolyline(position, activeRoute.polylinePoints) > 40;
    offRouteStreakRef.current = offRoute ? offRouteStreakRef.current + 1 : 0;
    if (offRouteStreakRef.current < 3) return;

    offRouteStreakRef.current = 0;
    reroutingRef.current = true;
    toast.info("Recalculating route…");
    computeRoute(position, destination, selectedMode as "WALKING" | "TWO_WHEELER" | "DRIVING", GOOGLE_KEY)
      .then((result) => {
        if (!result) return;
        setActiveRoute(result);
        setStepIndex(0);
        lastSpokenStepRef.current = -1;
      })
      .finally(() => {
        reroutingRef.current = false;
      });
  }, [position, isRoad, activeRoute, phase, selectedMode, destination, simulating]);

  // Voice guidance + arrival detection
  useEffect(() => {
    if (!live || phase !== "navigating" || !destination) return;

    if (live.remainingDistanceMeters < 15) {
      setPhase("arrived");
      if (isRoad && activeRoute) {
        setLastCompletedRoute({
          points: activeRoute.polylinePoints,
          distanceKm: activeRoute.distanceMeters / 1000,
          endLabel: destination.label,
        });
      }
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
    setSimulating(false);
    setSimulatedPosition(null);
  };

  const handleClose = () => {
    setDestination(null);
    setCustomOrigin(null);
    setLastCompletedRoute(null);
    setSimulating(false);
    setSimulatedPosition(null);
    router.replace("/navigate");
  };

  if (!ready || !destination) return null;

  const speedKmh = simulating
    ? (BASE_SPEEDS_MPS[selectedMode] ?? 1.4) * 3.6
    : position?.speed != null
      ? position.speed * 3.6
      : null;

  const totalSimDist = cumulativeDistances[cumulativeDistances.length - 1] ?? 0;
  const simulatedProgressPct = totalSimDist > 0 ? Math.min(100, Math.round((simulatedDistance / totalSimDist) * 100)) : 0;

  return (
    <div className="relative h-full w-full">
      <MapBase
        key={pickingOrigin ? "picking-origin" : "view"}
        me={activePosition}
        follow={phase === "navigating" && !manualPan}
        lookAheadMeters={phase === "navigating" && isRoad ? 30 : 0}
        onUserDrag={() => setManualPan(true)}
        showGrid
        pickingMode={pickingOrigin}
        onCenterChange={pickingOrigin ? handlePinCenterChange : undefined}
        routePoints={
          pickingOrigin
            ? []
            : isRoad && activeRoute
              ? activeRoute.polylinePoints
              : phase === "select"
                ? routes[selectedMode]?.polylinePoints ?? []
                : []
        }
        markers={
          pickingOrigin
            ? []
            : [
                { id: "dest", lat: destination.lat, lng: destination.lng, label: destination.label, color: "#DC2626" },
                ...(customOrigin
                  ? [{ id: "origin", lat: customOrigin.lat, lng: customOrigin.lng, label: customOrigin.label, color: "#16A34A" }]
                  : []),
                ...roadReports.map((r) => ({
                  id: `road-${r.id}`,
                  lat: r.lat,
                  lng: r.lng,
                  label: ROAD_ISSUE_LABEL[r.type],
                  color: "#F59E0B",
                })),
              ]
        }
        fitBounds={phase === "preview" && customOrigin ? [customOrigin, destination] : undefined}
        initialCenter={pickingOrigin ? (originPinDraft ?? position ?? destination) : (position ?? destination)}
      />

      {/* SOS — left-aligned and clear of the top turn-by-turn pill so it
          never collides with NavigationHud's full-width bar. */}
      <button
        onClick={() => router.push("/sos")}
        aria-label="SOS"
        className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+6.5rem)] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-emergency shadow-lg active:scale-95 transition-transform"
      >
        <ShieldAlert className="h-5 w-5 text-emergency-foreground" />
      </button>

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
            onClick={() => {
              setCustomOrigin(null);
              router.push("/navigate");
            }}
            className="m-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>

          <div className="mt-auto max-h-[75vh] overflow-y-auto rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] shadow-2xl">
            {customOrigin && !usingLiveGps && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-warning/10 px-3 py-2">
                <p className="text-xs font-bold text-warning">Navigating from Custom Start Point</p>
                <button onClick={handleUseCurrentLocation} className="text-xs font-bold text-primary underline active:opacity-70">
                  Use current location
                </button>
              </div>
            )}
            <div className="flex items-stretch gap-2">
              <button
                onClick={openOriginMenu}
                className="min-w-0 flex-1 rounded-2xl bg-secondary px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">From</p>
                <p className="truncate text-sm font-bold text-foreground">{customOrigin?.label ?? "Current location"}</p>
              </button>
              {customOrigin && (
                <button
                  onClick={() => setCustomOrigin(null)}
                  aria-label="Reset to current location"
                  className="flex h-auto w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">To</p>
                <p className="truncate text-sm font-bold text-foreground">{destination.label}</p>
              </div>
              {destinationWeather && (
                <button
                  type="button"
                  onClick={() => setWeatherOpen(true)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-card px-2.5 py-1.5 shadow-sm active:scale-95 transition-all border border-border/40 hover:border-primary/30"
                  title="Show Destination Weather Details"
                >
                  {(() => {
                    const Icon = weatherIcon(destinationWeather.condition);
                    return <Icon className="h-4 w-4 text-primary animate-pulse" />;
                  })()}
                  <span className="text-xs font-extrabold text-foreground">{destinationWeather.tempC}°C</span>
                </button>
              )}
            </div>

            {estimates[selectedMode] && estimates[selectedMode] !== "loading" && estimates[selectedMode] !== "unavailable" && (
              <div className="mt-4 flex items-center gap-6">
                <div>
                  <p className="text-2xl font-extrabold text-foreground">
                    {formatDistance((estimates[selectedMode] as { distanceMeters: number }).distanceMeters)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Distance</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">
                    {formatDuration((estimates[selectedMode] as { durationSeconds: number }).durationSeconds)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ETA</p>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
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
                      {est === "loading" ? "…" : est === "unavailable" || !est ? "N/A" : `${formatDuration(est.durationSeconds)} · ${formatDistance(est.distanceMeters)}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleGo}
              disabled={!routes[selectedMode]}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              GO
            </button>

            {roadReports.length > 0 && (
              <>
                <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Road conditions</p>
                <div className="mt-2 flex flex-col gap-2">
                  {roadReports.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-warning/10 p-3">
                      <TriangleAlert className="h-4 w-4 flex-shrink-0 text-warning" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{ROAD_ISSUE_LABEL[r.type]}</p>
                        {r.description && <p className="truncate text-xs font-medium text-muted-foreground">{r.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {placeNotes.length > 0 && (
              <>
                <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Community notes</p>
                {NOTE_KIND_ORDER.filter((k) => placeNotes.some((n) => n.kind === k)).map((k) => (
                  <div key={k} className="mt-2">
                    {k !== "general" && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-primary">{NOTE_KIND_LABEL[k]}</p>}
                    <div className="flex flex-col gap-2">
                      {placeNotes
                        .filter((n) => n.kind === k)
                        .map((n) => (
                          <div key={n.id} className="flex items-start gap-2 rounded-2xl bg-secondary p-3">
                            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <p className="text-sm font-medium text-foreground">{n.text}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {phase === "preview" && (
        <div className="absolute inset-0 z-20 flex flex-col">
          <button
            onClick={handleCancel}
            className="m-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform border border-border/40 hover:border-primary/30"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>

          <div className="mt-auto rounded-t-3xl bg-card p-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] shadow-2xl">
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-warning/10 px-3 py-2">
              <p className="text-xs font-bold text-warning">Navigating from Custom Start Point</p>
              <button onClick={handleUseCurrentLocation} className="flex-shrink-0 text-xs font-bold text-primary underline active:opacity-70">
                Use current location
              </button>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Route preview</p>
            <p className="mt-1 truncate text-lg font-extrabold text-foreground">
              {customOrigin?.label ?? "Custom start"} → {destination.label}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              You&apos;re not at the start point, so this is a preview — distance and time below, no live tracking.
            </p>

            {routes[selectedMode] && (
              <div className="mt-4 flex items-center gap-6">
                <div>
                  <p className="text-2xl font-extrabold text-foreground">{formatDistance(routes[selectedMode].distanceMeters)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Distance</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">{formatDuration(routes[selectedMode].durationSeconds)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duration</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleStartSimulation}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
              >
                Start Simulation
              </button>
              <button
                onClick={handleClose}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
              >
                Close Preview
              </button>
            </div>
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

      {phase === "navigating" && simulating && (
        <div
          className="absolute left-4 right-4 z-30 flex items-center justify-between gap-3 rounded-2xl bg-card/90 p-4 shadow-lg backdrop-blur"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 13.5rem)" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Simulation Mode</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">
              {simulatedPaused ? "Paused" : `Simulating @ ${simulationSpeed}x speed (${simulatedProgressPct}%)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSimulationSpeed((s) => (s === 1 ? 2 : s === 2 ? 5 : s === 5 ? 10 : 1))}
              className="h-10 px-3 rounded-xl bg-secondary text-xs font-bold text-foreground active:scale-95 transition-transform"
              title="Cycle speed multiplier"
            >
              {simulationSpeed}x
            </button>
            <button
              onClick={() => setSimulatedPaused((p) => !p)}
              className="flex h-10 w-20 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground active:scale-95 transition-transform"
            >
              {simulatedPaused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
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

          {placeNotes.some((n) => n.kind !== "general") && (
            <div className="w-full max-w-xs max-h-[30vh] overflow-y-auto rounded-2xl bg-card p-4 text-left shadow-lg">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Finding your way in</p>
              {NOTE_KIND_ORDER.filter((k) => k !== "general" && placeNotes.some((n) => n.kind === k)).map((k) => (
                <div key={k} className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{NOTE_KIND_LABEL[k]}</p>
                  <div className="mt-1 flex flex-col gap-1.5">
                    {placeNotes
                      .filter((n) => n.kind === k)
                      .map((n) => (
                        <p key={n.id} className="text-sm font-medium text-foreground">
                          {n.text}
                        </p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex w-full max-w-xs flex-col gap-3">
            {lastCompletedRoute && (
              <button
                onClick={() => router.push("/routes/create")}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary text-sm font-bold text-primary active:scale-95 transition-transform"
              >
                <Share2 className="h-4 w-4" /> Share this route with the community
              </button>
            )}
            <button
              onClick={handleClose}
              className="h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {originMenuOpen && (
        <>
          <div className="absolute inset-0 z-40 bg-black/20" onClick={() => setOriginMenuOpen(false)} />
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-40 rounded-3xl bg-card p-3 shadow-2xl">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Start from</p>
            <MenuRow icon={LocateFixed} label="Current Location" onClick={handleOriginMenuCurrentLocation} />
            <MenuRow icon={Search} label="Search" onClick={handleOriginMenuSearch} />
            <MenuRow icon={Bookmark} label="Saved Place" onClick={handleOriginMenuSaved} />
            <MenuRow icon={MapPinned} label="Drop a Pin" onClick={handleOriginMenuDropPin} border={false} />
          </div>
        </>
      )}

      {savedPlacesOpen && (
        <>
          <div className="absolute inset-0 z-40 bg-black/20" onClick={() => setSavedPlacesOpen(false)} />
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-40 max-h-[60vh] overflow-y-auto rounded-3xl bg-card p-3 shadow-2xl">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Saved places</p>
            {savedPlaces.length === 0 && <p className="px-3 py-4 text-sm font-medium text-muted-foreground">No saved places yet.</p>}
            {savedPlaces.map((p) => (
              <MenuRow key={p.id} icon={Bookmark} label={p.name} onClick={() => handleSavedPlaceSelect(p)} />
            ))}
          </div>
        </>
      )}

      {pickingOrigin && (
        <>
          <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-30">
            <button
              onClick={() => setPickingOrigin(false)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform border border-border/40 hover:border-primary/30"
              aria-label="Cancel"
            >
              <X className="h-6 w-6 text-foreground" />
            </button>
          </div>
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-30 rounded-3xl bg-card p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Drop the pin on your start point</p>
            <p className="mt-1 truncate text-lg font-extrabold text-foreground">
              {resolvingOriginPin ? "Locating…" : originPinDraft?.label ?? "Locating…"}
            </p>
            <button
              onClick={confirmOriginPin}
              disabled={!originPinDraft}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              Use this location
            </button>
          </div>
        </>
      )}

      <DestinationSearch
        open={originSearchOpen}
        onClose={() => setOriginSearchOpen(false)}
        onSelect={handleOriginSelect}
        onPlaceSelect={handleOriginPlaceSelect}
        near={position ?? destination}
      />

      <WeatherDetailsModal
        weather={destinationWeather}
        isOpen={weatherOpen}
        onClose={() => setWeatherOpen(false)}
      />
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  border = true,
}: {
  icon: typeof LocateFixed;
  label: string;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left active:scale-[0.98] transition-transform ${
        border ? "border-b border-border" : ""
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
      <span className="truncate text-sm font-bold text-foreground">{label}</span>
    </button>
  );
}
