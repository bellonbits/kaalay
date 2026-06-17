"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, Search, Mic, Car } from "lucide-react";
import MapBase from "@/components/shared/MapBase";
import DestinationSearch from "@/features/navigation/components/DestinationSearch";
import LocationCard from "@/features/navigation/components/LocationCard";
import PlaceDetailSheet from "@/features/navigation/components/PlaceDetailSheet";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { convertToWords, getNearbyPlaces } from "@/lib/api";
import { haversineMeters } from "@/features/location/geo";
import { addRecent } from "@/features/navigation/recents";
import { kaalayPlaceToDetail, type LocationPoint, type DetailPlace } from "@/features/navigation/types";
import type { Place } from "@/types/api";

export default function NavigatePage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  // Road-snapped when on a road (see useRoadSnap) — falls back to raw GPS off-road.
  const position = useLocationStore((s) => s.displayPosition);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);

  const [pinPoint, setPinPoint] = useState<LocationPoint | null>(null);
  const [resolving, setResolving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [following, setFollowing] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DetailPlace | null>(null);

  const lastResolvedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNearbyFetchRef = useRef<{ lat: number; lng: number } | null>(null);

  // Seed the pin with the live GPS fix the moment it's available — the map
  // must never open centered anywhere else.
  useEffect(() => {
    if (position && !pinPoint) {
      setPinPoint({ lat: position.lat, lng: position.lng, label: "Locating…" });
    }
  }, [position, pinPoint]);

  // Load nearby community places once we have a fix, so they're visible
  // (and tappable) on the map, not just reachable through search. Only
  // refetches once the user has actually moved ~300m, not on every GPS tick.
  useEffect(() => {
    if (!position) return;
    const last = lastNearbyFetchRef.current;
    if (last && haversineMeters(last.lat, last.lng, position.lat, position.lng) < 300) return;
    lastNearbyFetchRef.current = { lat: position.lat, lng: position.lng };
    getNearbyPlaces(position.lat, position.lng, 2)
      .then(setNearbyPlaces)
      .catch(() => {});
  }, [position]);

  const handleMarkerClick = useCallback(
    (id: string) => {
      const place = nearbyPlaces.find((p) => p.id === id);
      if (place) setSelectedPlace(kaalayPlaceToDetail(place));
    },
    [nearbyPlaces]
  );

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setFollowing(false);
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    setPinPoint((prev) => ({ lat, lng, label: prev?.label ?? "Locating…", words: undefined }));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (key === lastResolvedRef.current) return;
      setResolving(true);
      try {
        const res = await convertToWords(lat, lng);
        lastResolvedRef.current = key;
        setPinPoint({ lat, lng, label: `///${res.words}`, words: res.words });
      } catch {
        setPinPoint({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } finally {
        setResolving(false);
      }
    }, 450);
  }, []);

  const handleRecenter = () => {
    setFollowing(true);
  };

  const handleNavigate = (point: LocationPoint) => {
    setDestination(point);
    router.push("/navigate/route");
  };

  const handleSearchSelect = (point: LocationPoint) => {
    setDestination(point);
    router.push("/navigate/route");
  };

  const handlePlaceDirections = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setDestination({ lat: place.lat, lng: place.lng, label: place.name, words: place.words });
    setAutoStart(false);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  const handlePlaceStart = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setDestination({ lat: place.lat, lng: place.lng, label: place.name, words: place.words });
    setAutoStart(true);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  if (!ready) return null;

  return (
    <div className="relative h-full w-full">
      <MapBase
        me={position}
        pickingMode
        showGrid
        onCenterChange={handleCenterChange}
        follow={following}
        initialCenter={position ?? undefined}
        markers={nearbyPlaces.map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude, label: p.name, color: "#16A34A" }))}
        onMarkerClick={handleMarkerClick}
      />

      {/* Search bar */}
      <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 shadow-lg active:scale-[0.99] transition-transform"
        >
          <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left text-base font-semibold text-muted-foreground">Where do you want to go?</span>
          <Mic className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        </button>

        <button
          onClick={() => router.push("/ride")}
          className="mt-3 flex h-11 items-center gap-2 rounded-full bg-card px-4 shadow-lg active:scale-95 transition-transform"
        >
          <Car className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Request a ride</span>
        </button>
      </div>

      {/* Recenter button */}
      <button
        onClick={handleRecenter}
        aria-label="Recenter on my location"
        className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 18rem)" }}
      >
        <LocateFixed className={`h-5 w-5 ${following ? "text-primary" : "text-foreground"}`} />
      </button>

      {/* Location card */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        <LocationCard point={pinPoint} accuracy={position?.accuracy} resolving={resolving} onNavigate={handleNavigate} />
      </div>

      <DestinationSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
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
    </div>
  );
}
