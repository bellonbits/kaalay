"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Power,
  Wallet,
  ShieldAlert,
  Flame,
  Plus,
  Phone,
  MessageSquare,
  X,
  MapPin,
  Navigation
} from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useDriverDispatch } from "@/features/ride/useDriverDispatch";
import {
  getMyDriverProfile,
  updateDriverStatus,
  acceptRide,
  getNearbyRides,
  createRoadReport,
  triggerEmergencySos
} from "@/lib/api";
import type { DriverProfile, Ride, RoadReportType } from "@/types/api";

export default function DriverDashboardPage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [profile, setProfile] = useState<DriverProfile | null | "loading">("loading");
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Ride[]>([]);

  // Modals & Panels State
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<RoadReportType>("blocked");
  const [reportDesc, setReportDesc] = useState("");
  const [reporting, setReporting] = useState(false);
  const [recording, setRecording] = useState(false);

  const driverRowId = profile && profile !== "loading" ? profile.id : null;
  const { offers, dismissOffer } = useDriverDispatch(user?.id ?? null, driverRowId, online);

  const loadProfile = () => {
    getMyDriverProfile()
      .then((p) => {
        setProfile(p);
        setOnline(p.status === "online");
      })
      .catch(() => setProfile(null));
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Poll nearby requests and refresh profile stats every 30s to keep earnings up to date
  useEffect(() => {
    if (!online) return;
    const tick = () => {
      getNearbyRides().then(setNearby).catch(() => {});
      getMyDriverProfile().then(setProfile).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [online]);

  const toggleOnline = async () => {
    setToggling(true);
    const next = !online;
    try {
      await updateDriverStatus(next ? "online" : "offline");
      setOnline(next);
      toast.success(next ? "You are now online! Fetching matching offers..." : "You went offline.");
    } catch {
      toast.error("Couldn't update status");
    } finally {
      setToggling(false);
    }
  };

  const handleAccept = async (rideId: string) => {
    setAccepting(rideId);
    try {
      await acceptRide(rideId);
      dismissOffer(rideId);
      router.push(`/driver/ride/${rideId}`);
    } catch {
      toast.error("That ride was already taken");
      dismissOffer(rideId);
    } finally {
      setAccepting(null);
    }
  };

  const handleReportSubmit = async () => {
    if (!position) {
      toast.error("GPS position not available yet");
      return;
    }
    setReporting(true);
    try {
      await createRoadReport({
        type: reportType,
        lat: position.lat,
        lng: position.lng,
        description: reportDesc.trim() || undefined
      });
      toast.success("Community report submitted successfully!");
      setReportOpen(false);
      setReportDesc("");
    } catch {
      toast.error("Couldn't submit report");
    } finally {
      setReporting(false);
    }
  };

  const handleSos = async () => {
    if (!position) {
      toast.error("Location details unavailable");
      return;
    }
    try {
      await triggerEmergencySos({
        lat: position.lat,
        lng: position.lng,
        message: "Driver SOS triggered from home dashboard",
        severity: "red",
        type: "police"
      });
      toast.error("SOS Alert Dispatched to Emergency Responders!", { duration: 5000 });
      setSafetyOpen(false);
    } catch {
      toast.error("SOS request failed");
    }
  };

  // Generate simulated demand hotspots around driver location or default center
  const mapHotspots = useMemo(() => {
    const base = position ?? { lat: -1.2921, lng: 36.8219 };
    return [
      { id: "hotspot-1", lat: base.lat + 0.004, lng: base.lng - 0.003, label: "High Demand (Hotspot)", color: "#EF4444" },
      { id: "hotspot-2", lat: base.lat - 0.005, lng: base.lng + 0.006, label: "Medium Demand", color: "#F59E0B" }
    ];
  }, [position]);

  // Combine hot spots, driver location, and nearby requests as markers on the map
  const mapMarkers = useMemo(() => {
    const list = [...mapHotspots];
    nearby.forEach((ride) => {
      list.push({
        id: `ride-${ride.id}`,
        lat: ride.pickupLat,
        lng: ride.pickupLng,
        label: `Fare KES ${Math.round(ride.fare || 0)}`,
        color: "#10B981"
      });
    });
    return list;
  }, [mapHotspots, nearby]);

  if (!ready) return null;
  if (profile === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="animate-pulse text-lg font-bold text-muted-foreground">Loading Driver Platform…</div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center bg-background">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-2">
          <Navigation className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground">Become a Kaalay driver</h2>
        <p className="text-sm font-medium text-muted-foreground max-w-sm">
          Register your vehicle, driving license, and insurance to start earning on the Kaalay platform.
        </p>
        <button
          onClick={() => router.push("/driver/register")}
          className="h-14 w-full max-w-xs rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform shadow-lg shadow-primary/20"
        >
          Register as a driver
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Map Background */}
      <MapBase me={position} markers={mapMarkers} initialCenter={position ?? undefined} />

      {/* Glassmorphic Top Controls */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex flex-col gap-3">
        {/* Connection & Status Header */}
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-card/85 p-4 shadow-xl backdrop-blur-md border border-border/40">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status</p>
            </div>
            <p className={`text-lg font-black leading-tight ${online ? "text-primary" : "text-foreground"}`}>
              {online ? "Online" : "Offline"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/driver/earnings")}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground active:scale-95 transition-transform"
              title="Earnings & Wallet"
            >
              <Wallet className="h-5 w-5" />
            </button>
            <button
              onClick={toggleOnline}
              disabled={toggling}
              className={`flex h-12 px-5 items-center gap-2 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-40 shadow-sm ${
                online
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              <Power className="h-4 w-4" />
              <span>{online ? "GO OFFLINE" : "GO ONLINE"}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Earnings Stats Bar */}
        <div className="grid grid-cols-5 gap-1.5 rounded-2xl bg-card/80 p-3 shadow-lg backdrop-blur border border-border/30 text-center">
          <div>
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none">Wallet</span>
            <span className="block text-xs font-extrabold text-foreground mt-1 truncate">
              KES {Math.round(profile.walletBalance || 0)}
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none">Today</span>
            <span className="block text-xs font-extrabold text-primary mt-1 truncate">
              KES {Math.round(profile.earningsToday || 0)}
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none">Trips</span>
            <span className="block text-xs font-extrabold text-foreground mt-1">
              {profile.completedTripsToday || 0}
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none">Acceptance</span>
            <span className="block text-xs font-extrabold text-foreground mt-1">
              {Math.round((profile.acceptanceRate || 0.98) * 100)}%
            </span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none">Rating</span>
            <span className="block text-xs font-extrabold text-[#F59E0B] mt-1">
              ★ {profile.rating ? profile.rating.toFixed(1) : "4.9"}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Side Tools */}
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+9.5rem)] z-20 flex flex-col gap-2.5">
        {/* Hotspots Indicator Mode */}
        {online && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning text-warning-foreground shadow-lg animate-pulse" title="High Demand Near You">
            <Flame className="h-5 w-5" />
          </div>
        )}
        {/* Community Map Report Button */}
        <button
          onClick={() => setReportOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card hover:bg-card/90 text-foreground shadow-lg border border-border/40 active:scale-95 transition-transform"
          title="Community Mapping"
        >
          <Plus className="h-5 w-5 text-primary" />
        </button>
        {/* Safety SOS Panel Button */}
        <button
          onClick={() => setSafetyOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emergency hover:bg-emergency/90 text-emergency-foreground shadow-lg active:scale-95 transition-transform"
          title="Safety SOS Center"
        >
          <ShieldAlert className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom Offline/Online Guidelines */}
      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] z-20">
        {!online ? (
          <div className="rounded-3xl bg-card/95 p-5 text-center shadow-xl border border-border/45 backdrop-blur-md">
            <p className="text-sm font-bold text-foreground">You are offline</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Toggle status online to start receiving ride offers instantly.</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-3xl bg-card/95 p-5 text-center shadow-xl border border-border/45 backdrop-blur-md">
            <p className="text-sm font-bold text-foreground animate-pulse">Waiting for ride requests…</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{nearby.length} requests nearby right now</p>
          </div>
        ) : null}
      </div>

      {/* Real-time Ride Request Dialog Modal Overlay */}
      {offers.map((offer) => (
        <div key={offer.rideId} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] bg-card p-6 shadow-2xl border border-border/50 animate-slide-up-spring flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-primary">
                New ride request
              </span>
              <div className="flex items-center gap-1 text-[#F59E0B]">
                <span className="text-xs font-black">★ 4.8</span>
                <span className="text-[10px] text-muted-foreground font-semibold">(Rider Rating)</span>
              </div>
            </div>

            {/* Fare Indicator */}
            <div className="rounded-2xl bg-secondary/60 p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Est. Earnings (80%)</p>
              <p className="text-3xl font-black text-foreground mt-2">
                KES {Math.round(offer.fare * 0.8)}
              </p>
              <p className="text-xs font-bold text-muted-foreground mt-1 leading-none">Gross: KES {Math.round(offer.fare)} · Cash / M-Pesa</p>
            </div>

            {/* Distance / Duration Stats */}
            <div className="grid grid-cols-2 gap-2 text-center bg-secondary/30 rounded-xl py-2">
              <div>
                <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Distance</span>
                <span className="text-sm font-black text-foreground mt-0.5 block">{offer.distanceKm?.toFixed(1)} km</span>
              </div>
              <div>
                <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">ETA</span>
                <span className="text-sm font-black text-foreground mt-0.5 block">~12 mins</span>
              </div>
            </div>

            {/* Route path */}
            <div className="flex flex-col gap-2 rounded-2xl bg-secondary/20 p-3.5 border border-border/30">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4.5 w-4.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Pickup</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 truncate">{offer.pickup}</p>
                </div>
              </div>
              <div className="h-[1.5px] bg-border/40 w-full ml-7" />
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4.5 w-4.5 text-emergency mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Destination</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 truncate">{offer.destination}</p>
                </div>
              </div>
            </div>

            {/* Decline / Accept Actions */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => dismissOffer(offer.rideId)}
                className="h-14 rounded-2xl bg-secondary hover:bg-secondary/80 text-sm font-black text-foreground active:scale-95 transition-transform border border-border/40"
              >
                Reject Ride
              </button>
              <button
                onClick={() => handleAccept(offer.rideId)}
                disabled={accepting === offer.rideId}
                className="h-14 rounded-2xl bg-primary text-sm font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/25"
              >
                {accepting === offer.rideId ? "Accepting…" : "Accept Ride"}
              </button>
            </div>

            {/* Quick Contact buttons */}
            <div className="flex justify-center gap-4 mt-1">
              <button onClick={() => toast.info("Call simulation")} className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                <Phone className="h-3.5 w-3.5" /> Call Passenger
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button onClick={() => toast.info("Chat simulation")} className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Chat Passenger
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Safety Center Overlay Modal */}
      {safetyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-border animate-slide-up-spring flex flex-col gap-4 text-center">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-lg font-black text-foreground">Safety Toolkit</h3>
              <button onClick={() => setSafetyOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Emergency safety actions for drivers on the Kaalay network.</p>

            <button
              onClick={handleSos}
              className="h-16 w-full rounded-2xl bg-emergency text-base font-black text-emergency-foreground active:scale-95 transition-transform shadow-lg shadow-emergency/20 flex items-center justify-center gap-2"
            >
              <ShieldAlert className="h-5 w-5 animate-pulse" />
              TRIGGER EMERGENCY SOS
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText("https://kaalay.vercel.app/track/driver-live");
                toast.success("Live tracking code copied to clipboard!");
              }}
              className="h-12 w-full rounded-xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
            >
              Share Live Location Code
            </button>

            <button
              onClick={() => setRecording(!recording)}
              className={`h-12 w-full rounded-xl text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2 ${
                recording ? "bg-red-500 text-white animate-pulse" : "bg-secondary text-foreground"
              }`}
            >
              <span>{recording ? "🎙️ RECORDING AUDIO (TAP TO STOP)" : "🎙️ START TRIP RECORDING"}</span>
            </button>

            <button
              onClick={() => setSafetyOpen(false)}
              className="h-11 w-full rounded-xl bg-border/40 text-xs font-bold text-foreground mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Community Mapping Reporting Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-border animate-slide-up-spring flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-lg font-black text-foreground">Community Mapping</h3>
              <button onClick={() => setReportOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Report local roadblock events, closed gates, or navigation issues to help map Kaalay details.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Report Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "blocked", label: "Road Blocked" },
                  { id: "flooded", label: "Flooded" },
                  { id: "construction", label: "Construction" },
                  { id: "accident", label: "Accident" }
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setReportType(t.id)}
                    className={`h-11 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                      reportType === t.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Details / Landmarks</label>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="E.g., Blue gate beside mosque is locked, use alternative entrance"
                className="w-full bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm font-semibold outline-none h-24 resize-none"
              />
            </div>

            <button
              onClick={handleReportSubmit}
              disabled={reporting}
              className="h-13 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
            >
              {reporting ? "Submitting…" : "SUBMIT REPORT"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
