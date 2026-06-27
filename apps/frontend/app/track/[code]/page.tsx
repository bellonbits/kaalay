"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Users, MapPin, Clock, Loader2 } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useSessionSocket } from "@/features/location/useSessionSocket";
import { computeRoute, type RouteResult } from "@/features/navigation/routeService";
import MapBase from "@/components/shared/MapBase";
import { getSocket } from "@/lib/socket";
import { formatDistance, formatDuration } from "@/features/location/geo";

export default function TrackCodePage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const params = useParams();
  const code = typeof params?.code === "string" ? params.code : "";

  const position = useLocationStore((s) => s.position);
  const { location: hostLoc, status, viewerCount, viewersLoc } = useSessionSocket(code);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"WALKING" | "TWO_WHEELER" | "DRIVING" | "EMERGENCY">("DRIVING");

  // Generate a persistent unique ID for this viewer tab session
  const myViewerId = useMemo(() => (typeof window !== "undefined" ? crypto.randomUUID() : ""), []);

  // Periodically stream this viewer's own location & travel mode to other members/broadcaster
  useEffect(() => {
    if (!position || !code) return;
    const socket = getSocket();

    const sendUpdate = () => {
      socket.emit("viewer-location", {
        code,
        viewerId: myViewerId,
        name: user?.fullName ?? "Guest Viewer",
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        mode: selectedMode,
      });
    };

    sendUpdate(); // immediate push
    const interval = setInterval(sendUpdate, 5000); // push every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [position, code, user, myViewerId, selectedMode]);

  // Compute route from current viewer position to the host's position using selected travel mode
  useEffect(() => {
    if (!position || !hostLoc) return;
    setRouteLoading(true);
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    // Google Maps doesn't have an "EMERGENCY" mode, so we calculate driving route
    const computeMode = selectedMode === "EMERGENCY" ? "DRIVING" : selectedMode;

    computeRoute(
      position,
      { lat: hostLoc.lat, lng: hostLoc.lng },
      computeMode,
      googleKey
    )
      .then((res) => {
        setRouteResult(res);
      })
      .catch(() => {})
      .finally(() => {
        setRouteLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, hostLoc?.lat, hostLoc?.lng, selectedMode]);

  if (!ready) return null;

  if (status === "ended") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-background px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-danger/10">
          <Users className="h-10 w-10 text-danger" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">Session Ended</h2>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            This live location sharing session has been stopped by the broadcaster.
          </p>
        </div>
        <button
          onClick={() => router.push("/navigate")}
          className="h-14 w-full max-w-xs rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform border-2 border-primary"
        >
          Go back home
        </button>
      </div>
    );
  }

  // Helper to map viewer modes to custom image icons
  const getModeIconUrl = (mode?: string) => {
    switch (mode) {
      case "WALKING":
        return "/walking.png";
      case "TWO_WHEELER":
        return "/bike.png";
      case "DRIVING":
        return "/ride.png";
      case "EMERGENCY":
        return "/emergency.png";
      default:
        return undefined;
    }
  };

  // Markers to display on the map
  const markers = [
    // Host marker (green)
    ...(hostLoc
      ? [
          {
            id: "host",
            lat: hostLoc.lat,
            lng: hostLoc.lng,
            label: "Broadcaster",
            color: "#16A34A",
          },
        ]
      : []),
    // Other viewers markers (blue/custom images)
    ...Object.entries(viewersLoc)
      .filter(([id]) => id !== myViewerId)
      .map(([id, loc]) => ({
        id,
        lat: loc.lat,
        lng: loc.lng,
        label: loc.name,
        iconUrl: getModeIconUrl(loc.mode),
        color: "#3B82F6",
      })),
  ];

  return (
    <div className="relative h-full w-full">
      {/* Map behind HUD overlays */}
      <MapBase
        me={position}
        routePoints={routeResult?.polylinePoints}
        markers={markers}
        initialCenter={hostLoc ?? position ?? undefined}
        fitBounds={
          routeResult?.polylinePoints && routeResult.polylinePoints.length > 0
            ? [position!, hostLoc!]
            : undefined
        }
      />

      {/* Floating back button */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-30 flex items-center justify-between gap-2 pointer-events-none">
        <button
          onClick={() => router.push("/navigate")}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform border border-border/40 hover:border-primary/30"
          aria-label="Go Back"
        >
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>

        {/* Live Status indicator */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur border border-border/40">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success"></span>
          </span>
          <span className="text-xs font-black text-foreground">TRACKING LIVE</span>
        </div>
      </div>

      {/* Session Details Overlays */}
      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-30 flex flex-col gap-3">
        {/* Helper status overlay if route is loading */}
        {routeLoading && !routeResult && (
          <div className="flex items-center gap-2 rounded-2xl bg-card/90 px-4 py-3 shadow-lg backdrop-blur border border-border/40 self-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-bold text-muted-foreground">Calculating route…</span>
          </div>
        )}

        <div className="rounded-3xl bg-card p-5 shadow-2xl border border-border/40 backdrop-blur-md bg-card/95">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Sharing Code</p>
              <h3 className="text-xl font-black text-foreground tracking-wider mt-0.5">{code}</h3>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-xs font-bold text-foreground border border-border/20">
              <Users className="h-4 w-4 text-primary" />
              <span>{viewerCount} tracking</span>
            </div>
          </div>

          {/* Travel Mode selector */}
          <div className="mt-4 border-t border-border/50 pt-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">How are you coming?</p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { mode: "WALKING", label: "Walking", icon: "/walking.png" },
                { mode: "TWO_WHEELER", label: "Bike", icon: "/bike.png" },
                { mode: "DRIVING", label: "Car", icon: "/ride.png" },
                { mode: "EMERGENCY", label: "Emergency", icon: "/emergency.png" },
              ] as const).map((m) => {
                const active = selectedMode === m.mode;
                return (
                  <button
                    key={m.mode}
                    onClick={() => setSelectedMode(m.mode)}
                    className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-[9px] font-black border-2 transition-all active:scale-95 duration-200 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                        : "bg-secondary text-foreground border-transparent hover:border-muted-foreground/20"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt={m.label} className="h-7 w-7 object-contain" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route details (ETA, Distance) to reach host */}
          {routeResult && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
              <div className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3 border border-border/30">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Distance</p>
                  <p className="text-sm font-extrabold text-foreground">{formatDistance(routeResult.distanceMeters)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3 border border-border/30">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ETA to Host</p>
                  <p className="text-sm font-extrabold text-foreground">{formatDuration(routeResult.durationSeconds)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Member tracker section listing active viewers */}
          {Object.keys(viewersLoc).length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">People En Route</p>
              <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1">
                {Object.entries(viewersLoc).map(([id, loc]) => {
                  const isMe = id === myViewerId;
                  return (
                    <div key={id} className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getModeIconUrl(loc.mode) ?? "/walking.png"} alt={loc.mode} className="h-4 w-4 object-contain" />
                        {loc.name} {isMe && "(You)"}
                      </span>
                      <span className="text-muted-foreground">Tracking live</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hostLoc && (
            <p className="mt-4 text-center text-xs font-bold text-warning animate-pulse">
              Waiting for broadcaster to transmit GPS coordinates…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
