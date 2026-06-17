"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getAdminRides, forceCancelAdminRide } from "@/lib/api";
import AdminHeader from "../_components/AdminHeader";
import type { Ride, RideStatus } from "@/types/api";

const FILTERS: { id: RideStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "requested", label: "Requested" },
  { id: "accepted", label: "Accepted" },
  { id: "started", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const CANCELLABLE: RideStatus[] = ["requested", "accepted", "arriving", "arrived", "started"];

export default function AdminRidesPage() {
  const { ready } = useRequireRole("admin");
  const [rides, setRides] = useState<Ride[]>([]);
  const [filter, setFilter] = useState<RideStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = (f: RideStatus | "all") => getAdminRides(f === "all" ? undefined : f).then(setRides).catch(() => {});

  useEffect(() => {
    if (ready) load(filter);
  }, [ready, filter]);

  const handleCancel = async (id: string) => {
    setBusyId(id);
    try {
      await forceCancelAdminRide(id);
      setRides((prev) => prev.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
      toast.success("Ride cancelled");
    } catch {
      toast.error("Couldn't cancel ride");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <AdminHeader title="Rides" subtitle={`${rides.length} shown`} />

      <div className="flex gap-2 overflow-x-auto px-6 pb-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              filter === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-6">
        {rides.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">No rides to show</p>}
        {rides.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-foreground">
                {r.status}
              </span>
              <span className="text-xs font-bold text-muted-foreground">{r.category}</span>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-foreground">{`///${r.pickupWhat3words}`}</p>
            <p className="truncate text-xs font-semibold text-muted-foreground">{`→ ///${r.destinationWhat3words}`}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              KES {Math.round(r.fare ?? 0)} {r.driver?.fullName ? `· ${r.driver.fullName}` : ""}
            </p>
            {CANCELLABLE.includes(r.status) && (
              <button
                onClick={() => handleCancel(r.id)}
                disabled={busyId === r.id}
                className="mt-3 h-10 w-full rounded-xl bg-emergency/10 text-xs font-bold text-emergency active:scale-95 transition-transform disabled:opacity-40"
              >
                Force cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
