"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Power, Wallet } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useDriverDispatch } from "@/features/ride/useDriverDispatch";
import { getMyDriverProfile, updateDriverStatus, acceptRide, getNearbyRides } from "@/lib/api";
import type { DriverProfile, Ride } from "@/types/api";

export default function DriverDashboardPage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [profile, setProfile] = useState<DriverProfile | null | "loading">("loading");
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Ride[]>([]);

  const driverRowId = profile && profile !== "loading" ? profile.id : null;
  const { offers, dismissOffer } = useDriverDispatch(user?.id ?? null, driverRowId, online);

  useEffect(() => {
    getMyDriverProfile()
      .then((p) => {
        setProfile(p);
        setOnline(p.status === "online");
      })
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!online) return;
    const tick = () => getNearbyRides().then(setNearby).catch(() => {});
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
    } catch {
      toast.error("Couldn't update your status");
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

  if (!ready) return null;
  if (profile === "loading") return null;

  if (profile === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h2 className="text-2xl font-extrabold text-foreground">Become a Kaalay driver</h2>
        <p className="text-sm font-medium text-muted-foreground">Register your vehicle to start accepting ride requests.</p>
        <button
          onClick={() => router.push("/driver/register")}
          className="h-14 w-full max-w-xs rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
        >
          Register as a driver
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapBase me={position} initialCenter={position ?? undefined} />

      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 flex items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4 shadow-lg">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={`text-lg font-extrabold ${online ? "text-primary" : "text-foreground"}`}>{online ? "Online" : "Offline"}</p>
        </div>
        <button
          onClick={() => router.push("/driver/earnings")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95 transition-transform"
          aria-label="Earnings"
        >
          <Wallet className="h-5 w-5" />
        </button>
        <button
          onClick={toggleOnline}
          disabled={toggling}
          className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40 ${
            online ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          }`}
          aria-label={online ? "Go offline" : "Go online"}
        >
          <Power className="h-6 w-6" />
        </button>
      </div>

      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] z-20 flex flex-col gap-3">
        {offers.map((offer) => (
          <div key={offer.rideId} className="rounded-3xl bg-card p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">New ride request</p>
            <p className="mt-1 text-base font-extrabold text-foreground">
              {`///${offer.pickup} → ///${offer.destination}`}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {offer.distanceKm?.toFixed(1)} km away · KES {Math.round(offer.fare ?? 0)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => dismissOffer(offer.rideId)}
                className="h-12 rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
              >
                Decline
              </button>
              <button
                onClick={() => handleAccept(offer.rideId)}
                disabled={accepting === offer.rideId}
                className="h-12 rounded-2xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                {accepting === offer.rideId ? "Accepting…" : "Accept"}
              </button>
            </div>
          </div>
        ))}

        {online && offers.length === 0 && (
          <div className="rounded-3xl bg-card p-5 text-center shadow-2xl">
            <p className="text-sm font-bold text-foreground">Waiting for ride requests…</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{nearby.length} requests nearby right now</p>
          </div>
        )}

        {!online && (
          <div className="rounded-3xl bg-card p-5 text-center shadow-2xl">
            <p className="text-sm font-bold text-foreground">You&apos;re offline</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Go online to start receiving ride requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
