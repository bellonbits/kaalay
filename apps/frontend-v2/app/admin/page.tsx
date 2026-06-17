"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Car, MapPinned, ShieldAlert, MapPin, ChevronRight } from "lucide-react";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getAdminDashboardStats, getAdminActiveTrips } from "@/lib/api";
import type { AdminDashboardStats, AdminTrip } from "@/types/api";

const LINKS = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/drivers", label: "Drivers", icon: Car },
  { href: "/admin/rides", label: "Rides", icon: MapPinned },
  { href: "/admin/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/admin/places", label: "Places", icon: MapPin },
];

export default function AdminDashboardPage() {
  const { ready } = useRequireRole("admin");
  const router = useRouter();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [trips, setTrips] = useState<AdminTrip[]>([]);

  useEffect(() => {
    if (!ready) return;
    const load = () => {
      getAdminDashboardStats().then(setStats).catch(() => {});
      getAdminActiveTrips().then(setTrips).catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        <h1 className="text-2xl font-extrabold text-foreground">Admin</h1>
        <p className="text-xs font-semibold text-muted-foreground">Operations overview</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 px-6">
        <StatCard label="Active trips" value={stats?.activeTrips} />
        <StatCard label="Completed trips" value={stats?.completedTrips} />
        <StatCard label="Verified drivers" value={stats ? `${stats.verifiedDrivers}/${stats.totalDrivers}` : undefined} />
        <StatCard label="Total revenue" value={stats ? `KES ${Math.round(stats.totalRevenue).toLocaleString()}` : undefined} />
      </div>

      <div className="mt-6 flex flex-col gap-2 px-6">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm active:scale-[0.99] transition-transform"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <span className="flex-1 text-left text-sm font-bold text-foreground">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <div className="mt-6 px-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Live trips</p>
        <div className="mt-2 flex flex-col gap-2">
          {trips.length === 0 && <p className="py-6 text-center text-sm font-medium text-muted-foreground">No active trips right now</p>}
          {trips.map((t) => (
            <div key={t.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-foreground">
                  {t.status}
                </span>
                <span className="text-xs font-bold text-muted-foreground">{t.category}</span>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-foreground">{t.pickup}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">→ {t.destination}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">KES {Math.round(t.fare ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-foreground">{value ?? "…"}</p>
    </div>
  );
}
