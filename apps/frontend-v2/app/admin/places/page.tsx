"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getPlaces, deleteAdminPlace } from "@/lib/api";
import AdminHeader from "../_components/AdminHeader";
import type { Place } from "@/types/api";

export default function AdminPlacesPage() {
  const { ready } = useRequireRole("admin");
  const [places, setPlaces] = useState<Place[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (ready) getPlaces().then(setPlaces).catch(() => {});
  }, [ready]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this place?")) return;
    setBusyId(id);
    try {
      await deleteAdminPlace(id);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      toast.success("Place removed");
    } catch {
      toast.error("Couldn't remove place");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <AdminHeader title="Places" subtitle={`${places.length} community places`} />

      <div className="mt-2 flex flex-col gap-2 px-6">
        {places.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{p.name}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {p.words} {p.tags.length > 0 && `· ${p.tags.join(", ")}`}
              </p>
            </div>
            <button
              onClick={() => handleDelete(p.id)}
              disabled={busyId === p.id}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emergency/10 text-emergency active:scale-95 transition-transform disabled:opacity-40"
              aria-label={`Remove ${p.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
