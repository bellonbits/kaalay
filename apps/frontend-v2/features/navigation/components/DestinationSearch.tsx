"use client";
import { useEffect, useState } from "react";
import { Search, MapPin, Hash, X, Clock, Mic, UtensilsCrossed, ShoppingCart, Cross, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { autosuggest, convertToCoordinates, getPlace, searchPlaces } from "@/lib/api";
import { addRecent, getRecents, type RecentEntry } from "../recents";
import { useVoiceSearch } from "../useVoiceSearch";
import { newPlacesSession, searchGooglePlaces, getGooglePlaceDetails } from "../googlePlaces";
import { kaalayPlaceToDetail, googlePlaceToDetail, type LocationPoint, type DetailPlace } from "../types";

// Category badge per place tag — colored to match the reference's
// per-category recent-item icons (orange food, pink shopping, etc.).
function categoryBadge(tags: string[] = []) {
  const t = tags.map((x) => x.toLowerCase());
  if (t.some((x) => ["cafe", "restaurant", "food"].includes(x)))
    return { icon: UtensilsCrossed, bg: "bg-orange-100", color: "text-orange-600" };
  if (t.some((x) => ["shop", "shopping", "market", "supermarket"].includes(x)))
    return { icon: ShoppingCart, bg: "bg-pink-100", color: "text-pink-600" };
  if (t.some((x) => ["hospital", "clinic", "pharmacy"].includes(x)))
    return { icon: Cross, bg: "bg-red-100", color: "text-red-600" };
  return { icon: MapPin, bg: "bg-primary/10", color: "text-primary" };
}

interface Result {
  key: string;
  icon: "w3w" | "place" | "coords" | "google";
  title: string;
  subtitle?: string;
  placeId?: string;
  googlePlaceId?: string;
  resolve: () => Promise<LocationPoint>;
}

const COORD_PATTERN = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (point: LocationPoint) => void;
  onPlaceSelect: (place: DetailPlace) => void;
  near?: { lat: number; lng: number } | null;
}

export default function DestinationSearch({ open, onClose, onSelect, onPlaceSelect, near }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const { supported: voiceSupported, listening, start: startListening } = useVoiceSearch(setQuery);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    if (open) {
      setRecents(getRecents());
      newPlacesSession();
    }
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const coordMatch = q.match(COORD_PATTERN);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      setResults([
        {
          key: "coords",
          icon: "coords",
          title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          subtitle: "Raw coordinates",
          resolve: async () => ({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }),
        },
      ]);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const isW3wShaped = q.replace(/^\/\/\//, "").split(".").length === 3;
        const [w3wRes, placesRes, googleRes] = await Promise.allSettled([
          isW3wShaped ? convertToCoordinates(q.replace(/^\/\/\//, "")) : autosuggest(q, near?.lat, near?.lng),
          searchPlaces(q),
          searchGooglePlaces(q, near),
        ]);

        const next: Result[] = [];

        if (w3wRes.status === "fulfilled") {
          if (isW3wShaped && "latitude" in w3wRes.value) {
            const w = w3wRes.value;
            next.push({
              key: `w3w-${w.what3words}`,
              icon: "w3w",
              title: `///${w.what3words}`,
              subtitle: "what3words address",
              resolve: async () => ({ lat: w.latitude, lng: w.longitude, label: `///${w.what3words}`, words: w.what3words }),
            });
          } else if ("suggestions" in w3wRes.value) {
            for (const s of w3wRes.value.suggestions) {
              next.push({
                key: `w3w-${s.words}`,
                icon: "w3w",
                title: `///${s.words}`,
                subtitle: s.nearestPlace,
                resolve: async () => {
                  const coords = await convertToCoordinates(s.words);
                  return { lat: coords.latitude, lng: coords.longitude, label: `///${s.words}`, words: s.words };
                },
              });
            }
          }
        }

        if (placesRes.status === "fulfilled") {
          for (const p of placesRes.value) {
            next.push({
              key: `place-${p.id}`,
              icon: "place",
              title: p.name,
              subtitle: `///${p.words}`,
              placeId: p.id,
              resolve: async () => ({ lat: p.latitude, lng: p.longitude, label: p.name, words: p.words }),
            });
          }
        }

        if (googleRes.status === "fulfilled") {
          for (const g of googleRes.value) {
            next.push({
              key: `google-${g.placeId}`,
              icon: "google",
              title: g.mainText,
              subtitle: g.secondaryText,
              googlePlaceId: g.placeId,
              resolve: async () => {
                const detail = await getGooglePlaceDetails(g.placeId);
                return detail
                  ? { lat: detail.lat, lng: detail.lng, label: detail.name }
                  : { lat: 0, lng: 0, label: g.mainText };
              },
            });
          }
        }

        setResults(next);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [query, near?.lat, near?.lng]);

  const handleSelect = async (r: Result) => {
    if (r.icon === "place" && r.placeId) {
      const place = await getPlace(r.placeId);
      const detail = kaalayPlaceToDetail(place);
      addRecent({ kind: "place", key: `place-${place.id}`, place: detail });
      onPlaceSelect(detail);
      onClose();
      return;
    }
    if (r.icon === "google" && r.googlePlaceId) {
      const g = await getGooglePlaceDetails(r.googlePlaceId);
      if (!g) return;
      const detail = googlePlaceToDetail(g);
      addRecent({ kind: "place", key: `google-${g.placeId}`, place: detail });
      onPlaceSelect(detail);
      onClose();
      return;
    }
    const point = await r.resolve();
    addRecent({ kind: "point", key: r.key, point, subtitle: r.subtitle });
    onSelect(point);
    onClose();
  };

  const handleRecentSelect = (entry: RecentEntry) => {
    if (entry.kind === "place") {
      onPlaceSelect(entry.place);
    } else {
      onSelect(entry.point);
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[88dvh] rounded-t-3xl p-0">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="text-xl font-extrabold">Search destination</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-3">
          <div className="flex h-14 items-center gap-3 rounded-2xl border-2 border-input bg-background px-4">
            <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Where do you want to go?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {voiceSupported && (
              <button onClick={startListening} aria-label="Search by voice" className={listening ? "animate-pulse" : ""}>
                <Mic className={`h-4 w-4 ${listening ? "text-emergency" : "text-muted-foreground"}`} />
              </button>
            )}
          </div>
          {!query && (
            <p className="mt-2 px-1 text-xs font-medium text-muted-foreground">
              Try a what3words address, a place name, or coordinates.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {!query && recents.length > 0 && (
            <>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recents</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recents.map((r) => {
                  const badge = r.kind === "place" ? categoryBadge(r.place.tags) : { icon: Clock, bg: "bg-secondary", color: "text-muted-foreground" };
                  const Icon = badge.icon;
                  return (
                    <button
                      key={r.key}
                      onClick={() => handleRecentSelect(r)}
                      className="flex w-40 flex-shrink-0 items-center gap-2.5 rounded-2xl bg-secondary p-2.5 text-left active:scale-95 transition-transform"
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${badge.bg}`}>
                        <Icon className={`h-4 w-4 ${badge.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {r.kind === "place" ? r.place.name : r.point.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {loading && <p className="py-4 text-sm font-semibold text-muted-foreground">Searching…</p>}
          {!loading && query && results.length === 0 && (
            <p className="py-4 text-sm font-semibold text-muted-foreground">No matches found.</p>
          )}
          <div className="space-y-1">
            {results.map((r) => (
              <button
                key={r.key}
                onClick={() => handleSelect(r)}
                className="flex w-full items-center gap-4 rounded-2xl p-3 text-left active:bg-secondary transition-colors"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
                  {r.icon === "w3w" && <Hash className="h-5 w-5 text-primary" />}
                  {r.icon === "place" && <MapPin className="h-5 w-5 text-foreground" />}
                  {r.icon === "coords" && <MapPin className="h-5 w-5 text-muted-foreground" />}
                  {r.icon === "google" && <Building2 className="h-5 w-5 text-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{r.title}</p>
                  {r.subtitle && <p className="truncate text-xs font-medium text-muted-foreground">{r.subtitle}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
