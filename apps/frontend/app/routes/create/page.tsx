"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useNavigationStore } from "@/features/navigation/store";
import { createGuide } from "@/lib/api";

const CATEGORIES = ["walking", "cycling", "driving", "shortcut", "scenic"];

export default function CreateGuidePage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const lastCompletedRoute = useNavigationStore((s) => s.lastCompletedRoute);
  const setLastCompletedRoute = useNavigationStore((s) => s.setLastCompletedRoute);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && !lastCompletedRoute) router.replace("/routes");
  }, [ready, lastCompletedRoute, router]);

  useEffect(() => {
    if (lastCompletedRoute) setName(`Route to ${lastCompletedRoute.endLabel}`);
  }, [lastCompletedRoute]);

  const handleSave = async () => {
    if (!lastCompletedRoute || !name.trim()) return;
    setSaving(true);
    try {
      await createGuide({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category ?? undefined,
        waypoints: lastCompletedRoute.points,
        distanceKm: lastCompletedRoute.distanceKm ?? undefined,
      });
      toast.success("Route shared — thanks for helping others navigate");
      setLastCompletedRoute(null);
      router.replace("/routes");
    } catch {
      toast.error("Couldn't share this route — try again");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !lastCompletedRoute) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <p className="text-lg font-extrabold text-foreground">Share this route</p>
          <p className="text-xs font-semibold text-muted-foreground">
            {lastCompletedRoute.distanceKm ? `${lastCompletedRoute.distanceKm.toFixed(1)} km` : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes this route useful — a shortcut, easier walking surface, avoids a bad junction…"
          className="mt-2 h-24 w-full resize-none rounded-2xl bg-secondary p-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Category</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory((prev) => (prev === c ? null : c))}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="mt-8 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
        >
          {saving ? "Sharing…" : "Share route"}
        </button>
      </div>
    </div>
  );
}
