"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert, Hand, Users, MapPinned } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";

export default function EmergencySettingsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="flex items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-2xl font-extrabold text-foreground">Emergency Settings</h1>
      </div>

      <div className="space-y-4 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <SettingCard
          icon={ShieldAlert}
          title="The SOS button"
          description="The red SOS tab at the bottom of the app is always visible. Tap it to open the emergency category screen and send your location instantly."
        />
        <SettingCard
          icon={Hand}
          title="Silent SOS"
          description="Hold the SOS tab for about a second from anywhere in the app. It sends an alert with no screen change and no sound — only a brief vibration confirms it went through."
        />
        <SettingCard
          icon={Users}
          title="Trusted contacts"
          description="Everyone in your trusted contacts list is notified the moment you trigger any SOS, silent or not."
          action={{ label: "Manage trusted contacts", onClick: () => router.push("/profile/trusted-contacts") }}
        />
        <SettingCard
          icon={MapPinned}
          title="Nearby help"
          description="Every SOS screen offers directions to the nearest hospitals, police stations, and fire stations."
        />
      </div>
    </div>
  );
}

function SettingCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof ShieldAlert;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emergency/10">
          <Icon className="h-5 w-5 text-emergency" />
        </div>
        <h2 className="text-base font-extrabold text-foreground">{title}</h2>
      </div>
      <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">{description}</p>
      {action && (
        <button onClick={action.onClick} className="mt-3 text-sm font-bold text-primary">
          {action.label} →
        </button>
      )}
    </div>
  );
}
