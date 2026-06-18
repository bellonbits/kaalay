"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sparkles, ChevronRight, Search, Mic, Car, Bot } from "lucide-react";
import SafetyPulse from "@/components/shared/SafetyPulse";
import DestinationSearch from "@/features/navigation/components/DestinationSearch";
import PlaceDetailSheet from "@/features/navigation/components/PlaceDetailSheet";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { useShareStore } from "@/features/share/store";
import { getSafetySummary, listTrustedContacts } from "@/lib/api";
import { addRecent } from "@/features/navigation/recents";
import type { LocationPoint, DetailPlace } from "@/features/navigation/types";
import type { EmergencyContact, SafetySummary } from "@/types/api";

const TIPS = [
  "Share your trip with someone you trust before you head out at night.",
  "Keep your phone charged — SOS needs a live connection to reach help fast.",
  "Stick to well-lit, busier routes when walking after dark.",
  "Confirm your driver's plate and photo match before you get in.",
];

const RISK_COPY: Record<SafetySummary["riskTier"], { label: string; tone: string }> = {
  low: { label: "Low Risk", tone: "bg-success/10 text-success" },
  moderate: { label: "Moderate Risk", tone: "bg-warning/10 text-warning" },
  elevated: { label: "Elevated Risk", tone: "bg-emergency/10 text-emergency" },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function NavigatePage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  // Road-snapped when on a road (see useRoadSnap) — falls back to raw GPS off-road.
  const position = useLocationStore((s) => s.displayPosition);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);
  const activeShareToken = useShareStore((s) => s.activeToken);

  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<DetailPlace | null>(null);
  const [safety, setSafety] = useState<SafetySummary | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    if (!position) return;
    getSafetySummary(position.lat, position.lng).then(setSafety).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    if (activeShareToken) listTrustedContacts().then(setContacts).catch(() => {});
    else setContacts([]);
  }, [activeShareToken]);

  const goToDestination = (point: LocationPoint) => {
    setDestination(point);
    router.push("/navigate/route");
  };

  const handlePlaceDirections = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setDestination({ lat: place.lat, lng: place.lng, label: place.name, words: place.words });
    setAutoStart(false);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  const handlePlaceStart = (place: DetailPlace) => {
    addRecent({ kind: "place", key: `${place.source}-${place.id}`, place });
    setDestination({ lat: place.lat, lng: place.lng, label: place.name, words: place.words });
    setAutoStart(true);
    setSelectedPlace(null);
    router.push("/navigate/route");
  };

  if (!ready) return null;

  const risk = RISK_COPY[safety?.riskTier ?? "low"];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground">
            {user?.fullName?.charAt(0).toUpperCase() ?? "K"}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Hi, {greeting()}</p>
            <p className="text-base font-extrabold text-foreground">{user?.fullName ?? "there"}</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile")}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emergency" />
        </button>
      </div>

      {/* Risk + shared-with */}
      <div className="mt-5 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${risk.tone}`}>{risk.label}</span>
        {activeShareToken && contacts.length > 0 ? (
          <button onClick={() => router.push("/share")} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Shared with</span>
            <div className="flex -space-x-2">
              {contacts.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary/15 text-[10px] font-bold text-primary"
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </button>
        ) : (
          <button onClick={() => router.push("/share")} className="text-xs font-bold text-primary">
            Start sharing your trip
          </button>
        )}
      </div>

      {/* Safety pulse */}
      <div className="mt-2 flex flex-col items-center">
        <SafetyPulse accuracy={position?.accuracy} />
        <p className="mt-2 max-w-xs text-center text-sm font-medium text-muted-foreground">
          Your <span className="font-bold text-foreground">current area</span> is{" "}
          {(safety?.isDaytime ?? true) ? "well-lit" : "lit by streetlights"} with{" "}
          {safety?.openIncidentsNearby ? "a few recent reports nearby" : "no recent safety reports"}.
        </p>
        <button
          onClick={() => router.push("/sos/nearby")}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-foreground active:scale-95 transition-transform"
        >
          <span className="h-2 w-2 rounded-full bg-success" />
          View Nearby Safe Zones
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* AI safety tips */}
      <div className="mt-6 rounded-[1.75rem] bg-gradient-to-br from-primary to-success p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <p className="text-base font-extrabold">AI Safety Tips</p>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed opacity-95">{tip}</p>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/ride")}
          className="flex flex-col items-start gap-2 rounded-2xl bg-secondary p-4 text-left active:scale-95 transition-transform"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground">Book Safe Ride</p>
        </button>
        <button
          onClick={() => router.push("/ride/ai")}
          className="flex flex-col items-start gap-2 rounded-2xl bg-secondary p-4 text-left active:scale-95 transition-transform"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground">Book with AI</p>
        </button>
      </div>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="mt-4 flex h-14 w-full flex-shrink-0 items-center gap-3 rounded-2xl bg-secondary px-4 active:scale-[0.99] transition-transform"
      >
        <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left text-sm font-semibold text-muted-foreground">Search a place or get directions</span>
        <Mic className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </button>

      <DestinationSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={goToDestination}
        onPlaceSelect={(place) => setSelectedPlace(place)}
        near={position}
      />

      <PlaceDetailSheet
        place={selectedPlace}
        open={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onDirections={handlePlaceDirections}
        onStart={handlePlaceStart}
      />
    </div>
  );
}
