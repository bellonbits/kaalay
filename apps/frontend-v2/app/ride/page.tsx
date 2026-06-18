"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Search, Navigation as NavIcon, Car, Motorbike, Package, X } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import DestinationSearch from "@/features/navigation/components/DestinationSearch";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { convertToWords, createRide, getFareEstimates } from "@/lib/api";
import { haversineKm } from "@/features/location/geo";
import type { LocationPoint } from "@/features/navigation/types";
import type { FareEstimate, RideCategory } from "@/types/api";

const CATEGORIES: { id: RideCategory; label: string; icon: typeof Car }[] = [
  { id: "economy", label: "Economy", icon: Car },
  { id: "motorcycle", label: "Motorcycle", icon: Motorbike },
  { id: "xl", label: "XL", icon: Car },
  { id: "delivery", label: "Delivery", icon: Package },
];

type LocationField = "pickup" | "destination";

export default function RideRequestPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  // Drag-the-pin flow (MapBase's pickingMode), separate from the typed-search
  // sheet below so opening search doesn't remount/re-center the map.
  const [pickMode, setPickMode] = useState<LocationField | null>(null);
  const [pickDraft, setPickDraft] = useState<LocationPoint | null>(null);
  const [resolvingPick, setResolvingPick] = useState(false);
  const [searchField, setSearchField] = useState<LocationField | null>(null);
  const [category, setCategory] = useState<RideCategory>("economy");
  const [estimates, setEstimates] = useState<FareEstimate[] | null>(null);
  const [requesting, setRequesting] = useState(false);

  const lastResolvedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed pickup with the live GPS fix the moment it's available.
  useEffect(() => {
    if (!position || pickup) return;
    convertToWords(position.lat, position.lng)
      .then((res) => setPickup({ lat: position.lat, lng: position.lng, label: "Current location", words: res.words }))
      .catch(() => setPickup({ lat: position.lat, lng: position.lng, label: "Current location" }));
  }, [position, pickup]);

  // Fare estimate once both points are known.
  useEffect(() => {
    if (!pickup || !destination) {
      setEstimates(null);
      return;
    }
    const km = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);
    getFareEstimates(km).then(setEstimates).catch(() => setEstimates(null));
  }, [pickup, destination]);

  const startPickMode = (field: LocationField) => {
    const current = field === "pickup" ? pickup : destination;
    setPickDraft(current ?? (position ? { lat: position.lat, lng: position.lng, label: "Locating…" } : null));
    lastResolvedRef.current = null;
    setPickMode(field);
  };

  const handleCenterChange = (lat: number, lng: number) => {
    setPickDraft((prev) => ({ lat, lng, label: prev?.label ?? "Locating…" }));
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (key === lastResolvedRef.current) return;
      setResolvingPick(true);
      try {
        const res = await convertToWords(lat, lng);
        lastResolvedRef.current = key;
        setPickDraft({ lat, lng, label: res.words, words: res.words });
      } catch {
        setPickDraft({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } finally {
        setResolvingPick(false);
      }
    }, 450);
  };

  const confirmPick = () => {
    if (!pickDraft || !pickMode) return;
    if (pickMode === "pickup") setPickup(pickDraft);
    else setDestination(pickDraft);
    setPickMode(null);
  };

  const handleSearchSelect = (point: LocationPoint) => {
    if (searchField === "pickup") setPickup(point);
    else if (searchField === "destination") setDestination(point);
    setSearchField(null);
  };

  const handleConfirmRide = async () => {
    if (!pickup || !destination) return;
    setRequesting(true);
    try {
      const km = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);
      const ride = await createRide({
        pickup: { lat: pickup.lat, lng: pickup.lng, words: pickup.words ?? "" },
        destination: { lat: destination.lat, lng: destination.lng, words: destination.words ?? "" },
        category,
        distance: km,
        duration: (km / 30) * 60,
      });
      router.push(`/ride/${ride.id}`);
    } catch {
      toast.error("Couldn't request a ride — try again");
    } finally {
      setRequesting(false);
    }
  };

  if (!ready) return null;

  const selectedEstimate = estimates?.find((e) => e.category === category);

  return (
    <div className="relative h-full w-full">
      <MapBase
        key={pickMode ?? "view"}
        me={position}
        pickingMode={!!pickMode}
        onCenterChange={pickMode ? handleCenterChange : undefined}
        initialCenter={pickMode ? (pickDraft ?? position ?? undefined) : (pickup ?? position ?? undefined)}
        markers={
          pickMode
            ? []
            : [
                ...(pickup ? [{ id: "pickup", lat: pickup.lat, lng: pickup.lng, label: "Pickup", color: "#16A34A" }] : []),
                ...(destination
                  ? [{ id: "dest", lat: destination.lat, lng: destination.lng, label: "Destination", color: "#DC2626" }]
                  : []),
              ]
        }
      />

      <button
        onClick={() => (pickMode ? setPickMode(null) : router.back())}
        className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
        aria-label="Back"
      >
        {pickMode ? <X className="h-5 w-5 text-foreground" /> : <ArrowLeft className="h-5 w-5 text-foreground" />}
      </button>

      {pickMode ? (
        <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-20 rounded-3xl bg-card p-5 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {pickMode === "pickup" ? "Pickup location" : "Destination"}
          </p>
          <p className="mt-1 truncate text-lg font-extrabold text-foreground">
            {resolvingPick ? "Locating…" : (pickDraft?.label ?? "Locating…")}
          </p>
          <button
            onClick={confirmPick}
            disabled={!pickDraft}
            className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            Set this location
          </button>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-20 flex flex-col gap-4">
          <div className="rounded-3xl bg-card p-4 shadow-2xl">
            <LocationRow
              icon={MapPin}
              iconColor="text-primary"
              label="Pickup"
              value={pickup?.label ?? "Locating…"}
              onTap={() => startPickMode("pickup")}
              onSearch={() => setSearchField("pickup")}
            />
            <div className="my-2 ml-5 h-4 w-px bg-border" />
            <LocationRow
              icon={NavIcon}
              iconColor="text-emergency"
              label="Destination"
              value={destination?.label ?? "Where to?"}
              onTap={() => startPickMode("destination")}
              onSearch={() => setSearchField("destination")}
            />
          </div>

          {pickup && destination && (
            <div className="rounded-3xl bg-card p-4 shadow-2xl">
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map(({ id, label, icon: Icon }) => {
                  const est = estimates?.find((e) => e.category === id);
                  return (
                    <button
                      key={id}
                      onClick={() => setCategory(id)}
                      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-all ${
                        category === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                      <span className="text-[10px] font-semibold opacity-80">
                        {est ? `KES ${Math.round(est.fare)}` : "…"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleConfirmRide}
                disabled={requesting || !selectedEstimate}
                className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                {requesting ? "Requesting…" : `Request ${CATEGORIES.find((c) => c.id === category)?.label}`}
              </button>
            </div>
          )}
        </div>
      )}

      <DestinationSearch
        open={searchField !== null}
        onClose={() => setSearchField(null)}
        onSelect={handleSearchSelect}
        onPlaceSelect={(place) => handleSearchSelect({ lat: place.lat, lng: place.lng, label: place.name, words: place.words })}
        near={searchField === "destination" ? (pickup ?? position) : position}
      />
    </div>
  );
}

function LocationRow({
  icon: Icon,
  iconColor,
  label,
  value,
  onTap,
  onSearch,
}: {
  icon: typeof MapPin;
  iconColor: string;
  label: string;
  value: string;
  onTap: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
      <button onClick={onTap} className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
      </button>
      <button
        onClick={onSearch}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-secondary active:scale-95 transition-transform"
        aria-label={`Search for ${label.toLowerCase()}`}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
