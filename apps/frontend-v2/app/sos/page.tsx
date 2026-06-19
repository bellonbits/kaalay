"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPinned, Phone, X, Clock, MapPin } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useSosStore } from "@/features/sos/store";
import { SOS_CATEGORIES } from "@/features/sos/categories";
import { severityColor } from "@/features/sos/emergencyColors";
import { convertToWords, triggerEmergencySos, updateIncidentStatus } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { computeRoute } from "@/features/navigation/routeService";
import { useSessionSocket } from "@/features/location/useSessionSocket";
import { formatDistance, formatDuration } from "@/features/location/geo";
import MapBase from "@/components/shared/MapBase";
import type { EmergencyType, EmergencySeverity } from "@/types/api";

export default function SosPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.position);
  const { activeIncident, setActiveIncident, clear } = useSosStore();

  const [triggering, setTriggering] = useState<EmergencyType | null>(null);
  const [contacts, setContacts] = useState<{ name: string; phoneNumber: string }[]>([]);
  const [resolving, setResolving] = useState(false);

  // Ambulance simulator states
  const [ambulanceRoute, setAmbulanceRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [ambulanceIndex, setAmbulanceIndex] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  const spawnPoint = useMemo(() => {
    if (!activeIncident) return null;
    // Spawn the ambulance about 1km north-east of the incident
    return {
      lat: activeIncident.lat + 0.006,
      lng: activeIncident.lng + 0.006,
    };
  }, [activeIncident]);

  // Compute driving route from spawn point to incident location
  useEffect(() => {
    if (!spawnPoint || !activeIncident) return;
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    computeRoute(
      spawnPoint,
      { lat: activeIncident.lat, lng: activeIncident.lng },
      "DRIVING",
      googleKey
    )
      .then((res) => {
        if (!res) throw new Error("Route not found");
        setAmbulanceRoute(res.polylinePoints);
        setEtaSeconds(res.durationSeconds);
        setDistanceMeters(res.distanceMeters);
      })
      .catch(() => {
        // Fallback straight line animation path if API fails
        const steps = 60;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const ratio = i / steps;
          pts.push({
            lat: spawnPoint.lat + (activeIncident.lat - spawnPoint.lat) * ratio,
            lng: spawnPoint.lng + (activeIncident.lng - spawnPoint.lng) * ratio,
          });
        }
        setAmbulanceRoute(pts);
        setEtaSeconds(180);
        setDistanceMeters(950);
      });
  }, [spawnPoint, activeIncident]);

  // Animate the ambulance responder moving along the route
  useEffect(() => {
    if (ambulanceRoute.length === 0 || !activeIncident) return;
    setAmbulanceIndex(0);

    const interval = setInterval(() => {
      setAmbulanceIndex((prev) => {
        if (prev >= ambulanceRoute.length - 1) {
          clearInterval(interval);
          return prev;
        }
        const next = prev + 1;
        const ratioLeft = 1 - next / ambulanceRoute.length;
        setEtaSeconds(Math.max(0, Math.round((etaSeconds ?? 180) * ratioLeft)));
        setDistanceMeters(Math.max(0, Math.round((distanceMeters ?? 950) * ratioLeft)));
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceRoute, activeIncident]);

  const ambulancePos = ambulanceRoute[ambulanceIndex] ?? spawnPoint;

  // Stream user location to socket room so responders can track
  useEffect(() => {
    if (!activeIncident || !position) return;
    const socket = getSocket();

    socket.emit("join", activeIncident.shareToken);

    const interval = setInterval(() => {
      socket.emit("push-location", {
        code: activeIncident.shareToken,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
        timestamp: Date.now(),
      });
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [activeIncident, position]);

  // Subscribe to live viewer list (for real responder tracking updates)
  const { viewersLoc } = useSessionSocket(activeIncident?.shareToken);

  const handleTrigger = async (type: EmergencyType, severity: EmergencySeverity) => {
    if (!position || triggering) return;
    setTriggering(type);
    try {
      let words: string | undefined;
      try {
        words = (await convertToWords(position.lat, position.lng)).words;
      } catch {
        // Cloudflare/network hiccup — proceed without a w3w address
      }
      const res = await triggerEmergencySos({
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
        w3w: words,
        type,
        severity,
        message: `EMERGENCY: ${type} reported`,
      });
      setActiveIncident(res.incident);
      setContacts(res.contacts);
    } finally {
      setTriggering(null);
    }
  };

  const handleResolve = async () => {
    if (!activeIncident) return;
    setResolving(true);
    try {
      await updateIncidentStatus(activeIncident.id, "resolved");
      clear();
      setContacts([]);
      setAmbulanceRoute([]);
      setAmbulanceIndex(0);
    } finally {
      setResolving(false);
    }
  };

  if (!ready) return null;

  if (activeIncident) {
    const colors = severityColor(activeIncident.severity);

    // Map markers listing the incident (distress) and responder (ambulance)
    const mapMarkers = [
      {
        id: "incident-center",
        lat: activeIncident.lat,
        lng: activeIncident.lng,
        label: "Your Distress Signal",
        color: "#EF4444",
      },
      ...(ambulancePos
        ? [
            {
              id: "ambulance-responder",
              lat: ambulancePos.lat,
              lng: ambulancePos.lng,
              label: "Responding Ambulance",
              iconUrl: "/emergency.png",
            },
          ]
        : []),
      // Real connected responders/viewers
      ...Object.entries(viewersLoc).map(([id, loc]) => ({
        id,
        lat: loc.lat,
        lng: loc.lng,
        label: loc.name,
        iconUrl: "/emergency.png",
      })),
    ];

    return (
      <div className="relative h-full w-full bg-background">
        {/* Full-screen Active Incident Map */}
        <div className="absolute inset-0 z-0 h-[60%] w-full">
          <MapBase
            me={position}
            fitBounds={
              ambulancePos
                ? [position ?? { lat: activeIncident.lat, lng: activeIncident.lng }, ambulancePos]
                : undefined
            }
            routePoints={ambulanceRoute}
            markers={mapMarkers}
          />
        </div>

        {/* Pulsating status overlay */}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur border border-border/40">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger"></span>
            </span>
            <span className="text-xs font-black text-danger uppercase tracking-wider">
              {activeIncident.type.replace("_", " ")} ACTIVE
            </span>
          </div>
        </div>

        {/* Bottom details sheet */}
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-card px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-6 shadow-2xl border-t border-border/40 backdrop-blur-md bg-card/95">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <h2 className="text-xl font-black text-foreground">Responder Dispatch</h2>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">Ambulance team is coming to you</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
                style={{ backgroundColor: colors.bgSoft, color: colors.hex }}
              >
                {colors.label} Severity
              </span>
            </div>

            {/* Travel stats overlay */}
            {distanceMeters !== null && etaSeconds !== null && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3.5 border border-border/30">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">Distance</p>
                    <p className="text-base font-extrabold text-foreground">{formatDistance(distanceMeters)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-secondary/40 p-3.5 border border-border/30">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground font-black">ETA</p>
                    <p className="text-base font-extrabold text-foreground">{formatDuration(etaSeconds)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeIncident.what3words && (
              <div className="rounded-2xl bg-secondary/30 p-3 border border-border/20 text-center font-mono text-sm font-bold text-primary">
                {"///"}{activeIncident.what3words}
              </div>
            )}

            {contacts.length > 0 && (
              <p className="text-center text-xs font-bold text-muted-foreground leading-normal mt-1">
                {contacts.length} trusted contact{contacts.length === 1 ? "" : "s"} notified:{" "}
                <span className="text-foreground">{contacts.map((c) => c.name).join(", ")}</span>
              </p>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={() => router.push("/sos/nearby")}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform shadow-lg shadow-primary/20 border-2 border-primary"
              >
                <MapPinned className="h-5 w-5" /> View nearby help
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-base font-black text-foreground active:scale-95 transition-transform border-2 border-border/40 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />} I&apos;m safe now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-emergency">Emergency SOS</h1>
        <p className="mt-2 text-base font-medium text-muted-foreground">
          Tap your emergency type. Your location is shared instantly — no forms, no delay.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {SOS_CATEGORIES.map(({ type, label, icon: Icon, defaultSeverity }) => {
          const colors = severityColor(defaultSeverity);
          const isLoading = triggering === type;
          return (
            <button
              key={type}
              onClick={() => handleTrigger(type, defaultSeverity)}
              disabled={!!triggering || !position}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-3xl text-base font-bold transition-transform active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: colors.bgSoft, color: colors.hex }}
            >
              {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Icon className="h-8 w-8" strokeWidth={2.2} />}
              {label}
            </button>
          );
        })}
      </div>

      {!position && (
        <p className="mt-6 text-center text-sm font-semibold text-warning">Waiting for GPS signal before SOS can be sent…</p>
      )}

      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-secondary p-4">
        <Phone className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">
          Hold the red SOS tab anywhere in the app to send a silent alert — no screen, no sound.
        </p>
      </div>
    </div>
  );
}
