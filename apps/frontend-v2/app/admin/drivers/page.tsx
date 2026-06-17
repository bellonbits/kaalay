"use client";
import { useEffect, useState } from "react";
import { Check, X, Power } from "lucide-react";
import { toast } from "sonner";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getAdminDrivers, verifyAdminDriver, forceAdminDriverStatus } from "@/lib/api";
import AdminHeader from "../_components/AdminHeader";
import type { AdminDriver } from "@/types/api";

type Filter = "all" | "unverified";

export default function AdminDriversPage() {
  const { ready } = useRequireRole("admin");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [filter, setFilter] = useState<Filter>("unverified");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = (f: Filter) => getAdminDrivers(f === "unverified" ? false : undefined).then(setDrivers).catch(() => {});

  useEffect(() => {
    if (ready) load(filter);
  }, [ready, filter]);

  const handleVerify = async (d: AdminDriver, isVerified: boolean) => {
    setBusyId(d.id);
    try {
      await verifyAdminDriver(d.id, isVerified);
      setDrivers((prev) => (filter === "unverified" ? prev.filter((x) => x.id !== d.id) : prev.map((x) => (x.id === d.id ? { ...x, isVerified } : x))));
      toast.success(isVerified ? "Driver verified" : "Verification revoked");
    } catch {
      toast.error("Couldn't update driver");
    } finally {
      setBusyId(null);
    }
  };

  const handleForceOffline = async (d: AdminDriver) => {
    setBusyId(d.id);
    try {
      await forceAdminDriverStatus(d.id, "offline");
      setDrivers((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "offline" } : x)));
    } catch {
      toast.error("Couldn't force driver offline");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <AdminHeader title="Drivers" subtitle={`${drivers.length} shown`} />

      <div className="flex gap-2 px-6">
        {(["unverified", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-6">
        {drivers.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">No drivers to show</p>}
        {drivers.map((d) => (
          <div key={d.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{d.fullName ?? "Unnamed driver"}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {[d.vehicleModel, d.vehicleColor, d.licensePlate].filter(Boolean).join(" · ") || "No vehicle details"}
                </p>
              </div>
              <span
                className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                  d.isVerified ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                }`}
              >
                {d.isVerified ? "Verified" : "Pending"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {!d.isVerified ? (
                <button
                  onClick={() => handleVerify(d, true)}
                  disabled={busyId === d.id}
                  className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
                >
                  <Check className="h-4 w-4" /> Verify
                </button>
              ) : (
                <button
                  onClick={() => handleVerify(d, false)}
                  disabled={busyId === d.id}
                  className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-xs font-bold text-foreground active:scale-95 transition-transform disabled:opacity-40"
                >
                  <X className="h-4 w-4" /> Revoke
                </button>
              )}
              <button
                onClick={() => handleForceOffline(d)}
                disabled={busyId === d.id || d.status === "offline"}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-xs font-bold text-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                <Power className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
