"use client";
import { useEffect, useState } from "react";
import { MapPin, Navigation as NavIcon, X } from "lucide-react";
import DestinationSearch from "./DestinationSearch";
import type { LocationPoint, DetailPlace } from "../types";

type Field = "from" | "to" | null;

interface Props {
  open: boolean;
  onClose: () => void;
  near?: { lat: number; lng: number } | null;
  onGo: (origin: LocationPoint | null, destination: LocationPoint) => void;
}

function placeToPoint(place: DetailPlace): LocationPoint {
  return {
    lat: place.lat,
    lng: place.lng,
    label: place.name,
    words: place.words,
    placeId: place.source === "kaalay" ? place.id : undefined,
  };
}

/** "Where from / where to" planner opened from Home's Navigate quick action —
 * lets a trip be set up with a custom start point before routing, instead of
 * only ever starting from live GPS position. A plain overlay panel (not a
 * Sheet/Dialog) so it can host its own DestinationSearch sheet on top of it
 * without stacking two dialogs. */
export default function PlanTripSheet({ open, onClose, near, onGo }: Props) {
  const [field, setField] = useState<Field>(null);
  const [draftOrigin, setDraftOrigin] = useState<LocationPoint | null>(null);
  const [draftDestination, setDraftDestination] = useState<LocationPoint | null>(null);

  useEffect(() => {
    if (open) {
      setDraftOrigin(null);
      setDraftDestination(null);
    }
  }, [open]);

  const commit = (point: LocationPoint) => {
    if (field === "from") setDraftOrigin(point);
    else if (field === "to") setDraftDestination(point);
    setField(null);
  };

  const handleGo = () => {
    if (!draftDestination) return;
    onGo(draftOrigin, draftDestination);
  };

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-40 rounded-3xl bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold text-foreground">Plan your trip</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95 transition-transform"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => setField("from")}
            className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left active:scale-[0.98] transition-transform"
          >
            <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">From</p>
              <p className="truncate text-sm font-bold text-foreground">{draftOrigin?.label ?? "Current location"}</p>
            </div>
          </button>
          <button
            onClick={() => setField("to")}
            className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left active:scale-[0.98] transition-transform"
          >
            <NavIcon className="h-4 w-4 flex-shrink-0 text-emergency" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">To</p>
              <p className="truncate text-sm font-bold text-foreground">{draftDestination?.label ?? "Where to?"}</p>
            </div>
          </button>
        </div>

        <button
          onClick={handleGo}
          disabled={!draftDestination}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
        >
          <NavIcon className="h-5 w-5" /> Show route
        </button>
      </div>

      <DestinationSearch
        open={field !== null}
        onClose={() => setField(null)}
        onSelect={commit}
        onPlaceSelect={(place) => commit(placeToPoint(place))}
        near={near}
      />
    </>
  );
}
