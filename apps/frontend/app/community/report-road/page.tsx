"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Waves, Construction, CircleAlert, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { createRoadReport } from "@/lib/api";
import type { RoadReportType } from "@/types/api";

const TYPES: { id: RoadReportType; label: string; icon: typeof Ban }[] = [
  { id: "blocked", label: "Blocked", icon: Ban },
  { id: "flooded", label: "Flooded", icon: Waves },
  { id: "construction", label: "Construction", icon: Construction },
  { id: "accident", label: "Accident", icon: CircleAlert },
  { id: "other", label: "Other", icon: TriangleAlert },
];

export default function ReportRoadPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [pin, setPin] = useState<{ lat: number; lng: number }>(position ?? { lat: 0, lng: 0 });
  const [type, setType] = useState<RoadReportType | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const movedRef = useRef(!!position);

  const handleCenterChange = (lat: number, lng: number) => {
    movedRef.current = true;
    setPin({ lat, lng });
  };

  const handleSubmit = async () => {
    if (!type) return;
    setSubmitting(true);
    try {
      await createRoadReport({ type, lat: pin.lat, lng: pin.lng, description: description.trim() || undefined });
      toast.success("Reported — thanks for the heads up");
      router.push("/community");
    } catch {
      toast.error("Couldn't submit this report — try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="relative h-full w-full">
      <MapBase pickingMode onCenterChange={handleCenterChange} initialCenter={pin} />

      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <div className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-20 rounded-3xl bg-card p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Drop the pin on the issue</p>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition-all ${
                type === id ? "bg-emergency text-emergency-foreground" : "bg-secondary text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details — e.g. how long it's been blocked"
          className="mt-3 h-16 w-full resize-none rounded-2xl bg-secondary p-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <button
          onClick={handleSubmit}
          disabled={!type || submitting}
          className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
