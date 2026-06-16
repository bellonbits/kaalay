"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useNavigationStore } from "@/features/navigation/store";
import { getPlaces } from "@/lib/api";
import type { Place } from "@/types/api";

export default function SavedLocationsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const setDestination = useNavigationStore((s) => s.setDestination);

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    getPlaces()
      .then(setPlaces)
      .finally(() => setLoading(false));
  }, [ready]);

  const handleNavigate = (p: Place) => {
    setDestination({ lat: p.latitude, lng: p.longitude, label: p.name, words: p.words });
    router.push("/navigate/route");
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="flex items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Saved Locations</h1>
          <p className="text-xs font-semibold text-muted-foreground">Places saved by the Kaalay community</p>
        </div>
      </div>

      <div className="flex-1 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : places.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-muted-foreground">No saved places yet.</p>
        ) : (
          <div className="space-y-2">
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => handleNavigate(p)}
                className="flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{p.name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {"///"}
                    {p.words}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
