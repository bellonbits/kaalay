"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Navigation as NavigationIcon, MapPin, Bookmark, Star } from "lucide-react";
import type { DetailPlace } from "../types";

interface Props {
  place: DetailPlace | null;
  open: boolean;
  onClose: () => void;
  onDirections: (place: DetailPlace) => void;
  onStart: (place: DetailPlace) => void;
}

export default function PlaceDetailSheet({ place, open, onClose, onDirections, onStart }: Props) {
  if (!place) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl p-0">
        {place.photos.length > 0 && (
          <div className="flex h-48 w-full gap-1 overflow-x-auto">
            {place.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${place.name} photo ${i + 1}`} className="h-full w-full flex-shrink-0 object-cover" />
            ))}
          </div>
        )}

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-5">
          <SheetHeader className="p-0 text-left">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-2xl font-extrabold leading-tight">{place.name}</SheetTitle>
              <button
                aria-label="Save"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary active:scale-90 transition-transform"
              >
                <Bookmark className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </SheetHeader>

          {place.rating !== undefined && (
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="text-sm font-bold text-foreground">{place.rating.toFixed(1)}</span>
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="truncate text-sm font-bold text-primary">
              {place.source === "kaalay" ? place.words : place.address}
            </span>
          </div>

          {place.isOpenNow !== null && (
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${
                place.isOpenNow ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              {place.isOpenNow ? "Open now" : "Closed now"}
            </span>
          )}

          {place.description && <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">{place.description}</p>}

          {place.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {place.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => onDirections(place)}
              className="h-14 flex-1 rounded-2xl border-2 border-primary text-base font-bold text-primary active:scale-95 transition-transform"
            >
              Directions
            </button>
            <button
              onClick={() => onStart(place)}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
            >
              <NavigationIcon className="h-5 w-5" /> Start
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
