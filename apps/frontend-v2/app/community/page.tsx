"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Route as RouteIcon, TriangleAlert, ChevronRight } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { getNearbyPlaces, getNearbyGuides, getNearbyRoadReports } from "@/lib/api";
import type { Place, LocalGuide, RoadReport } from "@/types/api";

type Activity =
  | { kind: "place"; id: string; name: string; createdAt: string }
  | { kind: "guide"; id: string; name: string; createdAt: string };

const ENTRIES = [
  { icon: MapPin, label: "Add a place", description: "Map a shop, gate, or landmark", path: "/discover/add" },
  { icon: RouteIcon, label: "Share a route", description: "After finishing a trip in Navigate", path: "/routes/create" },
  { icon: TriangleAlert, label: "Report a road issue", description: "Blocked, flooded, or under construction", path: "/community/report-road" },
] as const;

export default function CommunityPage() {
  const { user, ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [places, setPlaces] = useState<Place[]>([]);
  const [guides, setGuides] = useState<LocalGuide[]>([]);
  const [reports, setReports] = useState<RoadReport[]>([]);

  useEffect(() => {
    if (!position) return;
    getNearbyPlaces(position.lat, position.lng, 50).then(setPlaces).catch(() => {});
    getNearbyGuides(position.lat, position.lng, 50).then(setGuides).catch(() => {});
    getNearbyRoadReports(position.lat, position.lng, 50).then(setReports).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

  const myPlaces = places.filter((p) => p.createdBy === user?.id).length;
  const myGuides = guides.filter((g) => g.createdBy === user?.id).length;
  const myReports = reports.filter((r) => r.reporterId === user?.id).length;

  const activity: Activity[] = [
    ...places.map((p) => ({ kind: "place" as const, id: p.id, name: p.name, createdAt: p.createdAt })),
    ...guides.map((g) => ({ kind: "guide" as const, id: g.id, name: g.name, createdAt: g.createdAt ?? "" })),
  ]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, 8);

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <p className="text-2xl font-extrabold text-foreground">Community</p>
        <p className="text-xs font-semibold text-muted-foreground">Help others reach places Google Maps can&apos;t find</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <div className="flex flex-col gap-2">
          {ENTRIES.map(({ icon: Icon, label, description, path }) => (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-foreground">{label}</p>
                <p className="truncate text-xs font-medium text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>

        <p className="mt-8 text-sm font-extrabold text-foreground">Your contributions</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard value={myPlaces} label="Places added" />
          <StatCard value={myGuides} label="Routes shared" />
          <StatCard value={myReports} label="Reports filed" />
        </div>

        {activity.length > 0 && (
          <>
            <p className="mt-8 text-sm font-extrabold text-foreground">Recent activity nearby</p>
            <div className="mt-3 flex flex-col gap-2">
              {activity.map((a) => (
                <button
                  key={`${a.kind}-${a.id}`}
                  onClick={() => router.push(a.kind === "place" ? `/place/${a.id}` : "/routes")}
                  className="flex items-center gap-3 rounded-2xl bg-secondary p-3 text-left active:scale-[0.98] transition-transform"
                >
                  {a.kind === "place" ? (
                    <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
                  ) : (
                    <RouteIcon className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                  <span className="truncate text-sm font-bold text-foreground">{a.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-sm">
      <p className="text-xl font-extrabold text-foreground">{value}</p>
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}
