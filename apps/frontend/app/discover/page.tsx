"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Star, MapPin, Compass } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { getNearbyPlaces, searchPlaces, resolveUploadUrl } from "@/lib/api";
import { haversineKm } from "@/features/location/geo";
import type { Place } from "@/types/api";

export default function DiscoverPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    getNearbyPlaces(position.lat, position.lng, 5).then(setPlaces).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      if (position) getNearbyPlaces(position.lat, position.lng, 5).then(setPlaces).catch(() => {});
      return;
    }
    const t = setTimeout(() => {
      searchPlaces(q).then(setPlaces).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    places.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).slice(0, 10);
  }, [places]);

  const filtered = activeTag ? places.filter((p) => p.tags.includes(activeTag)) : places;

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <div>
          <p className="text-2xl font-extrabold text-foreground">Discover</p>
          <p className="text-xs font-semibold text-muted-foreground">Places mapped by the community</p>
        </div>
        <button
          onClick={() => router.push("/discover/add")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground active:scale-95 transition-transform"
          aria-label="Add a place"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5">
        <div className="flex h-12 items-center gap-3 rounded-2xl bg-secondary px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, shops, markets…"
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTag(null)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                activeTag === null ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  activeTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-4">
        {filtered.length === 0 && (
          <EmptyState
            icon={Compass}
            title="No places found yet"
            subtitle="Be the first to map something nearby — a shop, a gate, a shortcut."
            action={{ label: "Add a place", onClick: () => router.push("/discover/add") }}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/place/${p.id}`)}
              className="flex flex-col overflow-hidden rounded-2xl bg-card text-left shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex h-24 w-full items-center justify-center bg-secondary">
                {p.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveUploadUrl(p.photos[0])} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <MapPin className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-extrabold text-foreground">{p.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {position ? `${haversineKm(position.lat, position.lng, p.latitude, p.longitude).toFixed(1)} km` : ""}
                  </span>
                  {p.averageRating ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-foreground">
                      <Star className="h-2.5 w-2.5 fill-warning text-warning" /> {p.averageRating}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">New</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
