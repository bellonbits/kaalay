"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getAdminIncidents, getAdminIncidentStats, updateAdminIncident } from "@/lib/api";
import type { AdminIncidentStats, Incident, IncidentStatus } from "@/types/api";

const FILTERS: { id: IncidentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "dispatched", label: "Dispatched" },
  { id: "resolved", label: "Resolved" },
];

const SEVERITY_COLOR: Record<string, string> = {
  green: "bg-success/15 text-success",
  yellow: "bg-warning/15 text-warning",
  orange: "bg-warning/15 text-warning",
  red: "bg-emergency/15 text-emergency",
  black: "bg-foreground/15 text-foreground",
};

export default function OperatorDashboardPage() {
  // Admins can also use this view — incident response is a shared
  // capability, not exclusive to the Emergency Operator role.
  const { ready } = useRequireRole(["emergency_operator", "admin"]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<AdminIncidentStats | null>(null);
  const [filter, setFilter] = useState<IncidentStatus | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = (f: IncidentStatus | "all") => {
    getAdminIncidents(f === "all" ? undefined : f).then(setIncidents).catch(() => {});
    getAdminIncidentStats().then(setStats).catch(() => {});
  };

  useEffect(() => {
    if (!ready) return;
    load(filter);
    const id = setInterval(() => load(filter), 15000);
    return () => clearInterval(id);
  }, [ready, filter]);

  const handleUpdate = async (id: string, status: IncidentStatus) => {
    setBusyId(id);
    try {
      await updateAdminIncident(id, status);
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      toast.success(`Marked ${status}`);
    } catch {
      toast.error("Couldn't update incident");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <div className="px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        <h1 className="text-2xl font-extrabold text-foreground">Emergency Response</h1>
        <p className="text-xs font-semibold text-muted-foreground">Live incidents needing dispatch</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 px-6">
        <StatCard label="Open" value={stats?.open} tone="text-emergency" />
        <StatCard label="Dispatched" value={stats?.dispatched} tone="text-warning" />
        <StatCard label="Resolved" value={stats?.resolved} tone="text-success" />
      </div>

      <div className="mt-4 flex gap-2 px-6">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              filter === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-6">
        {incidents.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">No incidents to show</p>}
        {incidents.map((i) => (
          <div key={i.id} className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${SEVERITY_COLOR[i.severity] ?? "bg-secondary"}`}>
                {i.severity}
              </span>
              <span className="text-xs font-bold capitalize text-muted-foreground">{i.type.replace("_", " ")}</span>
            </div>
            {i.message && <p className="mt-2 text-sm font-semibold text-foreground">{i.message}</p>}
            {i.what3words && <p className="mt-1 text-xs font-semibold text-muted-foreground">{i.what3words}</p>}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdate(i.id, "dispatched")}
                disabled={busyId === i.id || i.status !== "open"}
                className="h-10 rounded-xl bg-secondary text-xs font-bold text-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                Mark dispatched
              </button>
              <button
                onClick={() => handleUpdate(i.id, "resolved")}
                disabled={busyId === i.id || i.status === "resolved"}
                className="h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                Mark resolved
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${tone}`}>{value ?? "…"}</p>
    </div>
  );
}
