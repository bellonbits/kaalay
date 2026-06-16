"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Users,
  ShieldAlert,
  Languages,
  LogOut,
  ChevronRight,
  Check,
  Edit2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useAuthStore } from "@/features/auth/store";
import { updateProfile } from "@/lib/api";
import type { VoiceLanguage } from "@/features/navigation/useVoiceGuidance";

const LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: "en", label: "English" },
  { code: "so", label: "Somali" },
  { code: "sw", label: "Swahili" },
];

export default function ProfilePage() {
  const { ready, user } = useRequireAuth();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>(
    (typeof window !== "undefined" && (localStorage.getItem("kaalay_voice_lang") as VoiceLanguage)) || "en"
  );

  const handleSaveName = async () => {
    if (!name.trim() || name === user?.fullName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ fullName: name.trim() });
      await hydrate();
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  };

  const handlePickLanguage = (code: VoiceLanguage) => {
    setVoiceLang(code);
    localStorage.setItem("kaalay_voice_lang", code);
    setLangOpen(false);
  };

  const handleLogout = () => {
    logout();
    router.replace("/welcome");
  };

  if (!ready || !user) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-3xl font-extrabold text-primary-foreground">
          {user.fullName.charAt(0).toUpperCase()}
        </div>

        {editingName ? (
          <div className="mt-4 flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              onBlur={handleSaveName}
              className="h-11 w-48 text-center text-lg font-extrabold"
            />
            {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="mt-4 flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-foreground">{user.fullName}</h1>
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <p className="text-sm font-semibold text-muted-foreground">{user.role}</p>
      </div>

      <div className="mt-8 space-y-1 rounded-3xl bg-card p-2 shadow-sm">
        <InfoRow icon={Phone} label="Phone" value={user.phoneNumber} />
        <InfoRow icon={Mail} label="Email" value={user.email || "Not set"} border={false} />
      </div>

      <p className="mt-6 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Safety</p>
      <div className="mt-2 space-y-1 rounded-3xl bg-card p-2 shadow-sm">
        <NavRow icon={Users} label="Trusted Contacts" onClick={() => router.push("/profile/trusted-contacts")} />
        <NavRow icon={ShieldAlert} label="Emergency Settings" onClick={() => router.push("/profile/emergency-settings")} border={false} />
      </div>

      <p className="mt-6 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Preferences</p>
      <div className="mt-2 space-y-1 rounded-3xl bg-card p-2 shadow-sm">
        <NavRow icon={MapPin} label="Saved Locations" onClick={() => router.push("/profile/saved-locations")} />
        <NavRow
          icon={Languages}
          label="Voice Language"
          value={LANGUAGES.find((l) => l.code === voiceLang)?.label}
          onClick={() => setLangOpen(true)}
          border={false}
        />
      </div>

      <button
        onClick={handleLogout}
        className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>

      <Dialog open={langOpen} onOpenChange={setLangOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Voice guidance language</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handlePickLanguage(l.code)}
                className="flex h-14 w-full items-center justify-between rounded-2xl bg-secondary px-4 text-base font-bold text-foreground"
              >
                {l.label}
                {voiceLang === l.code && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Somali and Swahili use your device&apos;s built-in voice if installed; otherwise guidance falls back to English.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, border = true }: { icon: typeof Phone; label: string; value: string; border?: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-4 ${border ? "border-b border-border" : ""}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function NavRow({
  icon: Icon,
  label,
  value,
  onClick,
  border = true,
}: {
  icon: typeof Phone;
  label: string;
  value?: string;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-4 p-4 text-left ${border ? "border-b border-border" : ""}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{label}</p>
        {value && <p className="text-xs font-semibold text-muted-foreground">{value}</p>}
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </button>
  );
}
