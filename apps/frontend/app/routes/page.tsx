"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Route as RouteIcon, Footprints } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import EmptyState from "@/components/shared/EmptyState";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { getNearbyGuides, useGuide as markGuideUsed } from "@/lib/api";
import type { LocalGuide } from "@/types/api";

export default function RoutesPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);
  const setDestination = useNavigationStore((s) => s.setDestination);

  const [guides, setGuides] = useState<LocalGuide[]>([]);
  const [selected, setSelected] = useState<LocalGuide | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!position) return;
    getNearbyGuides(position.lat, position.lng, 10)
      .then(setGuides)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

  const handleUseRoute = async (guide: LocalGuide) => {
    setStarting(true);
    try {
      await markGuideUsed(guide.id);
      setDestination({ lat: guide.endLat, lng: guide.endLng, label: guide.name });
      router.push("/navigate/route");
    } catch {
      toast.error("Couldn't start this route — try again");
      setStarting(false);
    }
  };

  if (!ready) return null;

  if (selected) {
    return (
      <div className="relative h-full w-full">
        <MapBase
          routePoints={selected.waypoints}
          markers={[
            { id: "start", lat: selected.startLat, lng: selected.startLng, label: "Start", color: "#16A34A" },
            { id: "end", lat: selected.endLat, lng: selected.endLng, label: selected.name, color: "#DC2626" },
          ]}
          initialCenter={{ lat: selected.startLat, lng: selected.startLng }}
        />

        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20">
          <button
            onClick={() => setSelected(null)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
            aria-label="Back to routes"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>

        <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-20 rounded-3xl bg-card p-5 shadow-2xl">
          <p className="text-lg font-extrabold text-foreground">{selected.name}</p>
          {selected.description && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">{selected.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            {selected.distanceKm && <span>{selected.distanceKm.toFixed(1)} km</span>}
            <span>Used {selected.timesUsed} times</span>
            {selected.category && <span className="capitalize">{selected.category}</span>}
          </div>
          <button
            onClick={() => handleUseRoute(selected)}
            disabled={starting}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            {starting ? "Starting…" : "Use this route"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <p className="text-2xl font-extrabold text-foreground">Routes</p>
        <p className="text-xs font-semibold text-muted-foreground">Trips shared by locals who&apos;ve been there</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        {guides.length === 0 && (
          <EmptyState
            icon={RouteIcon}
            title="No shared routes nearby yet"
            subtitle="Finish a trip in Navigate and share it — you'll be the first."
          />
        )}
        <div className="flex flex-col gap-3">
          {guides.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <RouteIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-foreground">{g.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  {g.distanceKm && <span>{g.distanceKm.toFixed(1)} km</span>}
                  <span className="flex items-center gap-1">
                    <Footprints className="h-3 w-3" /> Used {g.timesUsed}×
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
