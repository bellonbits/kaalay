"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hospital, Shield, Flame, Loader2 } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { getNearestFacilities } from "@/lib/api";
import { searchNearbyEmergencyPlaces } from "@/features/navigation/googlePlaces";
import { bearing, cardinalDirection, formatDistance, haversineKm } from "@/features/location/geo";

interface NearbyResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "hospital" | "police" | "fire";
  distanceKm: number;
}

const FACILITY_ICONS: Record<NearbyResult["type"], typeof Hospital> = {
  hospital: Hospital,
  police: Shield,
  fire: Flame,
};

const FACILITY_LABELS: Record<NearbyResult["type"], string> = {
  hospital: "Hospital",
  police: "Police",
  fire: "Fire station",
};

const GOOGLE_TYPE_MAP = { hospital: "hospital", police: "police", fire: "fire_station" } as const;

export default function NearbyHelpPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.position);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);

  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!position) return;
    setLoading(true);

    // Kaalay's own seeded facility list is sparse and centered on a few
    // well-known landmarks — it won't have anything near most actual
    // neighborhoods (e.g. Zimmerman in Nairobi). Google Places Nearby
    // Search fills that gap with whatever's genuinely closest, anywhere.
    Promise.all([
      getNearestFacilities(position.lat, position.lng, undefined, 10).catch(() => []),
      Promise.all(
        (Object.keys(GOOGLE_TYPE_MAP) as (keyof typeof GOOGLE_TYPE_MAP)[]).map((type) =>
          searchNearbyEmergencyPlaces(position.lat, position.lng, GOOGLE_TYPE_MAP[type], 8000).then((places) =>
            places.map((p) => ({
              id: `g-${p.placeId}`,
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              type,
              distanceKm: haversineKm(position.lat, position.lng, p.lat, p.lng),
            }))
          )
        )
      ),
    ]).then(([backend, googleGroups]) => {
      const backendResults: NearbyResult[] = backend
        .filter((f) => f.type === "hospital" || f.type === "police" || f.type === "fire")
        .map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng, type: f.type as NearbyResult["type"], distanceKm: f.distanceKm }));

      const merged = [...backendResults, ...googleGroups.flat()].sort((a, b) => a.distanceKm - b.distanceKm);
      setResults(merged.slice(0, 15));
      setLoading(false);
    });
  }, [position]);

  const handleDirections = (f: NearbyResult) => {
    setDestination({ lat: f.lat, lng: f.lng, label: f.name });
    setAutoStart(true);
    router.push("/navigate/route");
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Nearby help</h1>
          <p className="text-xs font-semibold text-muted-foreground">Hospitals, police, and fire stations near you</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && results.length === 0 && (
          <p className="py-10 text-center text-sm font-semibold text-muted-foreground">
            No emergency facilities found nearby.
          </p>
        )}

        <div className="space-y-3">
          {results.map((f) => {
            const Icon = FACILITY_ICONS[f.type] ?? Hospital;
            const dir = position ? cardinalDirection(bearing(position.lat, position.lng, f.lat, f.lng)) : null;
            return (
              <button
                key={f.id}
                onClick={() => handleDirections(f)}
                className="flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{f.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{FACILITY_LABELS[f.type]}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-extrabold text-primary">{formatDistance(f.distanceKm * 1000)}</p>
                  {dir && <p className="text-[10px] font-bold uppercase text-muted-foreground">{dir}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
