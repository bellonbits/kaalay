"use client";
import { useEffect, useState } from "react";
import { MapPin, Navigation as NavIcon, X, LocateFixed, Search, Bookmark, MapPinned } from "lucide-react";
import DestinationSearch from "./DestinationSearch";
import { getPlaces } from "@/lib/api";
import type { LocationPoint, DetailPlace } from "../types";
import type { Place } from "@/types/api";

type Field = "from" | "to" | null;

interface Props {
  open: boolean;
  onClose: () => void;
  near?: { lat: number; lng: number } | null;
  onGo: (origin: LocationPoint | null, destination: LocationPoint) => void;
  /** Hands off to the parent (which owns the real map) to let the user drop
   * a pin for the "From" point — calls `resolve` with the chosen point once
   * confirmed, or `null` if cancelled. While this is in flight, the sheet
   * renders nothing so the parent's own picking-mode map underneath is
   * fully interactive. */
  onRequestPinDrop: (resolve: (point: LocationPoint | null) => void) => void;
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
export default function PlanTripSheet({ open, onClose, near, onGo, onRequestPinDrop }: Props) {
  const [field, setField] = useState<Field>(null);
  const [draftOrigin, setDraftOrigin] = useState<LocationPoint | null>(null);
  const [draftDestination, setDraftDestination] = useState<LocationPoint | null>(null);
  const [originMenuOpen, setOriginMenuOpen] = useState(false);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [pinDropping, setPinDropping] = useState(false);

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

  const handleDropPin = () => {
    setOriginMenuOpen(false);
    setPinDropping(true);
    onRequestPinDrop((point) => {
      if (point) setDraftOrigin(point);
      setPinDropping(false);
    });
  };

  const handleSavedPlace = () => {
    setOriginMenuOpen(false);
    setSavedPlacesOpen(true);
    getPlaces().then(setSavedPlaces).catch(() => {});
  };

  if (!open || pinDropping) return null;

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
            onClick={() => setOriginMenuOpen(true)}
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

      {originMenuOpen && (
        <>
          <div className="absolute inset-0 z-50 bg-black/20" onClick={() => setOriginMenuOpen(false)} />
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-50 rounded-3xl bg-card p-3 shadow-2xl">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Start from</p>
            <MenuRow
              icon={LocateFixed}
              label="Current Location"
              onClick={() => {
                setOriginMenuOpen(false);
                setDraftOrigin(null);
              }}
            />
            <MenuRow
              icon={Search}
              label="Search"
              onClick={() => {
                setOriginMenuOpen(false);
                setField("from");
              }}
            />
            <MenuRow icon={Bookmark} label="Saved Place" onClick={handleSavedPlace} />
            <MenuRow icon={MapPinned} label="Drop a Pin" onClick={handleDropPin} border={false} />
          </div>
        </>
      )}

      {savedPlacesOpen && (
        <>
          <div className="absolute inset-0 z-50 bg-black/20" onClick={() => setSavedPlacesOpen(false)} />
          <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-50 max-h-[60vh] overflow-y-auto rounded-3xl bg-card p-3 shadow-2xl">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Saved places</p>
            {savedPlaces.length === 0 && <p className="px-3 py-4 text-sm font-medium text-muted-foreground">No saved places yet.</p>}
            {savedPlaces.map((p) => (
              <MenuRow
                key={p.id}
                icon={Bookmark}
                label={p.name}
                onClick={() => {
                  setDraftOrigin({ lat: p.latitude, lng: p.longitude, label: p.name, words: p.words, placeId: p.id });
                  setSavedPlacesOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}

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

function MenuRow({
  icon: Icon,
  label,
  onClick,
  border = true,
}: {
  icon: typeof LocateFixed;
  label: string;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left active:scale-[0.98] transition-transform ${
        border ? "border-b border-border" : ""
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
      <span className="truncate text-sm font-bold text-foreground">{label}</span>
    </button>
  );
}
