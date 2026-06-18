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
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import DestinationSearch from "@/features/navigation/components/DestinationSearch";
import PlaceDetailSheet from "@/features/navigation/components/PlaceDetailSheet";
import PlanTripSheet from "@/features/navigation/components/PlanTripSheet";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { getNearbyPlaces, getNearbyRoadReports, getWeather } from "@/lib/api";
import { addRecent } from "@/features/navigation/recents";
import { haversineKm } from "@/features/location/geo";
import { kaalayPlaceToDetail, type LocationPoint, type DetailPlace } from "@/features/navigation/types";
import { weatherIcon } from "@/features/weather/weatherIcon";
import type { Place, RoadReport, WeatherInfo } from "@/types/api";

const ROAD_ISSUE_LABEL: Record<RoadReport["type"], string> = {
  blocked: "Road blocked",
  flooded: "Flooded",
  construction: "Construction",
  accident: "Accident",
  other: "Road issue",
};

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

  const [searchOpen, setSearchOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<DetailPlace | null>(null);
  const [following, setFollowing] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [roadReports, setRoadReports] = useState<RoadReport[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  const lastNearbyFetchRef = useRef<{ lat: number; lng: number } | null>(null);

  // Same 300m-moved gate used elsewhere — avoids refetching on every GPS tick.
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
    getWeather(position.lat, position.lng)
      .then(setWeather)
      .catch(() => {});
  }, [position]);

  const WeatherIcon = weather ? weatherIcon(weather.condition) : null;

  const goToDestination = (point: LocationPoint) => {
    setOrigin(null);
    setDestination(point);
    router.push("/navigate/route");
  };

  const handlePlanGo = (origin: LocationPoint | null, destination: LocationPoint) => {
    setOrigin(origin);
    setDestination(destination);
    setAutoStart(false);
    setPlanOpen(false);
    router.push("/navigate/route");
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
        me={position}
        follow={following}
        onUserDrag={() => setFollowing(false)}
        initialCenter={position ?? undefined}
        markers={[
          ...nearbyPlaces.map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, label: p.name, color: "#16A34A" })),
          ...roadReports.map((r) => ({
            id: `road-${r.id}`,
            lat: r.lat,
            lng: r.lng,
            label: ROAD_ISSUE_LABEL[r.type],
            color: "#F59E0B",
          })),
        ]}
        onMarkerClick={handleMarkerClick}
      />

      {/* Header */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
            {user?.fullName?.charAt(0).toUpperCase() ?? "K"}
          </div>
          <p className="text-sm font-extrabold text-foreground">Hey {user?.fullName?.split(" ")[0] ?? "there"}</p>
        </div>
        <div className="flex items-center gap-2">
          {weather && WeatherIcon && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-card px-3 py-2 shadow-lg" title={weather.description}>
              <WeatherIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-extrabold text-foreground">{weather.tempC}°C</span>
            </div>
          )}
          <button
            onClick={() => router.push("/profile")}
            className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emergency" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <button
        onClick={() => setSearchOpen(true)}
        className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-20 flex h-14 items-center gap-3 rounded-2xl bg-card px-4 shadow-lg active:scale-[0.99] transition-transform"
      >
        <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left text-base font-semibold text-muted-foreground">Where do you want to go?</span>
        <Mic className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </button>

      {/* Recenter */}
      <button
        onClick={() => setFollowing(true)}
        aria-label="Recenter on my location"
        className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 15.5rem)" }}
      >
        <LocateFixed className={`h-5 w-5 ${following ? "text-primary" : "text-foreground"}`} />
      </button>

      {/* Navigation Assistant entry point */}
      <button
        onClick={() => router.push("/assistant")}
        className="absolute left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-white shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 15.5rem)" }}
      >
        <Bot className="h-4 w-4" />
        <span className="text-xs font-bold">Ask Kaalay anything</span>
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-center text-[10px] font-bold leading-tight text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <DestinationSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={goToDestination}
        onPlaceSelect={(place) => setSelectedPlace(place)}
        near={position}
      />

      <PlaceDetailSheet
        place={selectedPlace}
        open={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onDirections={handlePlaceDirections}
        onStart={handlePlaceStart}
      />

      <PlanTripSheet open={planOpen} onClose={() => setPlanOpen(false)} near={position} onGo={handlePlanGo} />
    </div>
  );
}
