"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  Mic,
  LocateFixed,
  Navigation as NavIcon,
  Share2,
  Bookmark,
  TriangleAlert,
  Car,
  MessageCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import PlaceDetailSheet from "@/features/navigation/components/PlaceDetailSheet";
import PlanTripSheet from "@/features/navigation/components/PlanTripSheet";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { getNearbyPlaces, getNearbyRoadReports, getWeather, convertToWords } from "@/lib/api";
import { addRecent } from "@/features/navigation/recents";
import { haversineKm } from "@/features/location/geo";
import { kaalayPlaceToDetail, type LocationPoint, type DetailPlace } from "@/features/navigation/types";
import { weatherIcon } from "@/features/weather/weatherIcon";
import WeatherDetailsModal from "@/features/weather/components/WeatherDetailsModal";
import type { Place, RoadReport, WeatherInfo } from "@/types/api";

const ROAD_ISSUE_LABEL: Record<RoadReport["type"], string> = {
  blocked: "Road blocked",
  flooded: "Flooded",
  construction: "Construction",
  accident: "Accident",
  other: "Road issue",
};

const CITIES = [
  { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Mombasa", lat: -4.05, lng: 39.67 },
  { name: "Kisumu", lat: -0.09, lng: 34.77 },
  { name: "Nakuru", lat: -0.30, lng: 36.07 },
  { name: "Mogadishu", lat: 2.04, lng: 45.34 }
];

function getNearestCityName(lat: number, lng: number): string {
  let bestCity = CITIES[0].name;
  let minDistance = Infinity;
  for (const city of CITIES) {
    const dist = Math.pow(city.lat - lat, 2) + Math.pow(city.lng - lng, 2);
    if (dist < minDistance) {
      minDistance = dist;
      bestCity = city.name;
    }
  }
  return bestCity;
}

// Discover and Local Guides already have their own bottom-nav tabs — kept
// out of here so the same icon doesn't appear twice on the home screen.
const QUICK_ACTIONS = [
  { label: "Navigate", icon: NavIcon, kind: "plan" as const },
  { label: "Share Location", icon: Share2, path: "/share" },
  { label: "Saved Places", icon: Bookmark, path: "/profile/saved-locations" },
  { label: "Report Road", icon: TriangleAlert, path: "/community/report-road" },
  { label: "Book a Ride", icon: Car, path: "/ride" },
];

export default function NavigatePage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  // Road-snapped when on a road (see useRoadSnap) — falls back to raw GPS off-road.
  const position = useLocationStore((s) => s.displayPosition);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setOrigin = useNavigationStore((s) => s.setOrigin);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);

  const [planOpen, setPlanOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<DetailPlace | null>(null);
  const [following, setFollowing] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [roadReports, setRoadReports] = useState<RoadReport[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [pickingPlanOrigin, setPickingPlanOrigin] = useState(false);
  const [planPinDraft, setPlanPinDraft] = useState<LocationPoint | null>(null);
  const [resolvingPlanPin, setResolvingPlanPin] = useState(false);

  const lastNearbyFetchRef = useRef<{ lat: number; lng: number } | null>(null);
  const planPinResolveRef = useRef<((point: LocationPoint | null) => void) | null>(null);
  const lastResolvedPlanPinRef = useRef<string | null>(null);
  const planPinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch nearby places and road reports on 300m distance threshold
  useEffect(() => {
    if (!position) return;
    const last = lastNearbyFetchRef.current;
    if (last && haversineKm(last.lat, last.lng, position.lat, position.lng) * 1000 < 300) return;
    lastNearbyFetchRef.current = { lat: position.lat, lng: position.lng };
    getNearbyPlaces(position.lat, position.lng, 2)
      .then(setNearbyPlaces)
      .catch(() => {});
    getNearbyRoadReports(position.lat, position.lng, 5)
      .then(setRoadReports)
      .catch(() => {});
  }, [position]);

  // Real weather fetch and 5-minute auto-refresh loop
  useEffect(() => {
    if (!position) return;

    const fetchWeather = () => {
      getWeather(position.lat, position.lng)
        .then((w) => {
          setWeather(w);
          setWeatherError(false);
        })
        .catch(() => {
          setWeather(null);
          setWeatherError(true);
        });
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [position?.lat, position?.lng]);


  const handlePlanGo = (origin: LocationPoint | null, destination: LocationPoint) => {
    setOrigin(origin);
    setDestination(destination);
    setAutoStart(false);
    setPlanOpen(false);
    router.push("/navigate/route");
  };

  const handlePlanRequestPinDrop = (resolve: (point: LocationPoint | null) => void) => {
    planPinResolveRef.current = resolve;
    lastResolvedPlanPinRef.current = null;
    setPlanPinDraft(position ? { lat: position.lat, lng: position.lng, label: "Locating…" } : null);
    setPickingPlanOrigin(true);
  };

  const handlePlanPinCenterChange = (lat: number, lng: number) => {
    setPlanPinDraft((prev) => ({ lat, lng, label: prev?.label ?? "Locating…" }));
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (planPinDebounceRef.current) clearTimeout(planPinDebounceRef.current);
    planPinDebounceRef.current = setTimeout(async () => {
      if (key === lastResolvedPlanPinRef.current) return;
      setResolvingPlanPin(true);
      try {
        const res = await convertToWords(lat, lng);
        lastResolvedPlanPinRef.current = key;
        setPlanPinDraft({ lat, lng, label: res.words, words: res.words });
      } catch {
        setPlanPinDraft({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } finally {
        setResolvingPlanPin(false);
      }
    }, 450);
  };

  const confirmPlanPin = () => {
    if (!planPinDraft) return;
    planPinResolveRef.current?.(planPinDraft);
    planPinResolveRef.current = null;
    setPickingPlanOrigin(false);
  };

  const cancelPlanPin = () => {
    planPinResolveRef.current?.(null);
    planPinResolveRef.current = null;
    setPickingPlanOrigin(false);
  };

  const handlePlaceDirections = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setOrigin(null);
    setDestination({
      lat: place.lat,
      lng: place.lng,
      label: place.name,
      words: place.words,
      placeId: place.source === "kaalay" ? place.id : undefined,
    });
    setAutoStart(false);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  const handlePlaceStart = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setOrigin(null);
    setDestination({
      lat: place.lat,
      lng: place.lng,
      label: place.name,
      words: place.words,
      placeId: place.source === "kaalay" ? place.id : undefined,
    });
    setAutoStart(true);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  const handleQuickAction = useCallback(
    (action: (typeof QUICK_ACTIONS)[number]) => {
      if (action.kind === "plan") setPlanOpen(true);
      else router.push(action.path);
    },
    [router]
  );

  const handleMarkerClick = useCallback(
    (id: string) => {
      if (id.startsWith("road-")) {
        const report = roadReports.find((r) => `road-${r.id}` === id);
        if (report) toast.warning(`${ROAD_ISSUE_LABEL[report.type]}${report.description ? ` — ${report.description}` : ""}`);
        return;
      }
      const place = nearbyPlaces.find((p) => p.id === id);
      if (place) setSelectedPlace(kaalayPlaceToDetail(place));
    },
    [nearbyPlaces, roadReports]
  );

  if (!ready) return null;

  return (
    <div className="relative h-full w-full">
      {/* Map is the hero — fills the whole screen behind the floating chrome */}
      <MapBase
        key={pickingPlanOrigin ? "picking-plan-origin" : "view"}
        me={position}
        follow={following && !pickingPlanOrigin}
        onUserDrag={() => setFollowing(false)}
        initialCenter={pickingPlanOrigin ? (planPinDraft ?? position ?? undefined) : (position ?? undefined)}
        pickingMode={pickingPlanOrigin}
        onCenterChange={pickingPlanOrigin ? handlePlanPinCenterChange : undefined}
        markers={
          pickingPlanOrigin
            ? []
            : [
                ...nearbyPlaces.map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, label: p.name, color: "#16A34A" })),
                ...roadReports.map((r) => ({
                  id: `road-${r.id}`,
                  lat: r.lat,
                  lng: r.lng,
                  label: ROAD_ISSUE_LABEL[r.type],
                  color: "#F59E0B",
                })),
              ]
        }
        onMarkerClick={pickingPlanOrigin ? undefined : handleMarkerClick}
      />

      {/* Header */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex items-center justify-between gap-2">
        <div className="flex h-14 items-center gap-3 rounded-2xl bg-card px-4 shadow-lg border border-border/40">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
            {user?.fullName?.charAt(0).toUpperCase() ?? "K"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-tight text-foreground">Hey {user?.fullName?.split(" ")[0] ?? "there"}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {weather ? (
                weather.cityName.toLowerCase() === "mogadishu" ? "Mogadishu, SO" :
                weather.cityName.toLowerCase() === "nairobi" ? "Nairobi, KE" :
                weather.cityName.toLowerCase() === "mombasa" ? "Mombasa, KE" :
                weather.cityName.toLowerCase() === "kisumu" ? "Kisumu, KE" :
                weather.cityName.toLowerCase() === "nakuru" ? "Nakuru, KE" :
                weather.cityName
              ) : position ? `${getNearestCityName(position.lat, position.lng)}` : "Locating…"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {weather ? (
            <button
              onClick={() => setWeatherOpen(true)}
              className="flex h-14 items-center gap-2 rounded-2xl bg-card px-4 shadow-lg active:scale-95 transition-all duration-200 border border-border/40 hover:border-primary/30"
              title="Show Weather Details"
            >
              {(() => {
                const Icon = weatherIcon(weather.condition);
                return <Icon className="h-5 w-5 text-primary animate-pulse" />;
              })()}
              <div className="text-left">
                <span className="block text-xs font-black text-foreground leading-none">{weather.tempC}°C</span>
                <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                  {weather.condition}
                </span>
              </div>
            </button>
          ) : weatherError ? (
            <div className="flex h-14 items-center justify-center rounded-2xl bg-card px-4 shadow-lg border border-border/40 text-[10px] font-bold text-muted-foreground">
              Weather data unavailable
            </div>
          ) : null}

          <button
            onClick={() => router.push("/profile")}
            className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform border border-border/40 hover:border-primary/30"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-emergency" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <button
        onClick={() => setPlanOpen(true)}
        className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+5.5rem)] z-20 flex h-14 items-center gap-3 rounded-2xl bg-card px-4 shadow-lg active:scale-[0.99] transition-transform"
      >
        <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left text-base font-semibold text-muted-foreground">Where do you want to go?</span>
        <Mic className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </button>

      {/* Recenter */}
      <button
        onClick={() => setFollowing(true)}
        aria-label="Recenter on my location"
        className="absolute right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-lg active:scale-95 transition-transform border border-border/40"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 15.5rem)" }}
      >
        <LocateFixed className={`h-6 w-6 ${following ? "text-primary" : "text-foreground"}`} />
      </button>

      {/* Messages — chat with the Kaalay assistant or your driver */}
      <button
        onClick={() => router.push("/messages")}
        aria-label="Messages"
        className="absolute left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 15.5rem)" }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>

      {/* SOS — one tap from any map screen, not just buried in Profile */}
      <button
        onClick={() => router.push("/sos")}
        aria-label="SOS"
        className="absolute left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-emergency shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 19.5rem)" }}
      >
        <ShieldAlert className="h-6 w-6 text-emergency-foreground" />
      </button>

      {/* Bottom sheet: quick actions */}
      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-card px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-4 shadow-2xl">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              className="flex w-20 flex-shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <action.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-center text-[10px] font-bold leading-tight text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <PlaceDetailSheet
        place={selectedPlace}
        open={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onDirections={handlePlaceDirections}
        onStart={handlePlaceStart}
      />

      <PlanTripSheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        near={position}
        onGo={handlePlanGo}
        onRequestPinDrop={handlePlanRequestPinDrop}
      />

      {pickingPlanOrigin && (
        <>
          <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-50">
            <button
              onClick={cancelPlanPin}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
              aria-label="Cancel"
            >
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-50 rounded-3xl bg-card p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Drop the pin on your start point</p>
            <p className="mt-1 truncate text-lg font-extrabold text-foreground">
              {resolvingPlanPin ? "Locating…" : planPinDraft?.label ?? "Locating…"}
            </p>
            <button
              onClick={confirmPlanPin}
              disabled={!planPinDraft}
              className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              Use this location
            </button>
          </div>
        </>
      )}

      <WeatherDetailsModal
        weather={weather}
        isOpen={weatherOpen}
        onClose={() => setWeatherOpen(false)}
      />
    </div>
  );
}
