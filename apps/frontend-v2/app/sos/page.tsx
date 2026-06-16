"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPinned, Phone, X } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useSosStore } from "@/features/sos/store";
import { SOS_CATEGORIES } from "@/features/sos/categories";
import { severityColor } from "@/features/sos/emergencyColors";
import { convertToWords, triggerEmergencySos, updateIncidentStatus } from "@/lib/api";
import type { EmergencyType, EmergencySeverity } from "@/types/api";

export default function SosPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.position);
  const { activeIncident, setActiveIncident, clear } = useSosStore();

  const [triggering, setTriggering] = useState<EmergencyType | null>(null);
  const [contacts, setContacts] = useState<{ name: string; phoneNumber: string }[]>([]);
  const [resolving, setResolving] = useState(false);

  const handleTrigger = async (type: EmergencyType, severity: EmergencySeverity) => {
    if (!position || triggering) return;
    setTriggering(type);
    try {
      let words: string | undefined;
      try {
        words = (await convertToWords(position.lat, position.lng)).words;
      } catch {
        // Cloudflare/network hiccup — proceed without a w3w address rather
        // than blocking the alert on it.
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
    } finally {
      setResolving(false);
    }
  };

  if (!ready) return null;

  if (activeIncident) {
    const colors = severityColor(activeIncident.severity);
    return (
      <div className="flex h-full w-full flex-col bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.bgSoft }}
          >
            <span className="h-4 w-4 animate-ping rounded-full" style={{ backgroundColor: colors.hex }} />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-foreground">Emergency location shared</h1>
          <span
            className="mt-2 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
            style={{ backgroundColor: colors.bgSoft, color: colors.hex }}
          >
            {activeIncident.type.replace("_", " ")} · {colors.label} severity
          </span>
          {activeIncident.what3words && (
            <p className="mt-4 font-mono text-sm font-bold text-primary">{"///"}{activeIncident.what3words}</p>
          )}

          {contacts.length > 0 && (
            <p className="mt-4 text-sm font-semibold text-muted-foreground">
              {contacts.length} trusted contact{contacts.length === 1 ? "" : "s"} notified: {contacts.map((c) => c.name).join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/sos/nearby")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            <MapPinned className="h-5 w-5" /> View nearby help
          </button>
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-base font-bold text-foreground active:scale-95 transition-transform disabled:opacity-50"
          >
            {resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />} I&apos;m safe now
          </button>
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
