"use client";
import { useMemo, useState } from "react";
import { Users, Share2, LogOut, Crown } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useGroupSession } from "@/features/meet/useGroupSession";
import { haversineMeters, formatDistance, formatDuration } from "@/features/location/geo";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function MeetPage() {
  const { ready, user } = useRequireAuth();
  const position = useLocationStore((s) => s.position);

  const [step, setStep] = useState<"setup" | "live">("setup");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const memberId = useMemo(() => (typeof window !== "undefined" ? crypto.randomUUID() : ""), []);
  const name = user?.fullName ?? "Me";

  const { members, hostId, isHost, claimHost } = useGroupSession(step === "live" ? activeCode : null, memberId, name, position);

  const handleCreate = () => {
    const code = randomCode();
    setActiveCode(code);
    setStep("live");
    setTimeout(claimHost, 300); // let join-group land first
  };

  const handleJoin = () => {
    if (joinCode.trim().length < 4) return;
    setActiveCode(joinCode.trim().toUpperCase());
    setStep("live");
  };

  const handleLeave = () => {
    setStep("setup");
    setActiveCode(null);
  };

  const handleShare = async () => {
    const text = `Join me on Kaalay — meeting code: ${activeCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!ready) return null;

  if (step === "live" && activeCode) {
    const host = members.find((m) => m.memberId === hostId);
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
          <div>
            <p className="text-2xl font-extrabold tracking-widest text-foreground">{activeCode}</p>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {members.length} here
            </p>
          </div>
          <button
            onClick={handleShare}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground active:scale-95 transition-transform"
            aria-label="Share meeting code"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
          {isHost && (
            <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-sm font-bold text-primary">
              You are the meeting point — others are heading to you.
            </div>
          )}

          <div className="space-y-3">
            {members.map((m) => {
              const isMe = m.memberId === memberId;
              const distanceMeters =
                !isMe && host?.lat != null && m.lat != null ? haversineMeters(m.lat, m.lng!, host.lat, host.lng!) : null;
              const fresh = Date.now() - m.lastSeen < 12000;
              return (
                <div key={m.memberId} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm">
                  <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary text-base font-extrabold text-foreground">
                    {m.name.charAt(0).toUpperCase()}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                        fresh ? "bg-success" : "bg-warning"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-foreground">
                      {m.name} {isMe && "(You)"} {m.memberId === hostId && <Crown className="h-3.5 w-3.5 text-warning" />}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {m.memberId === hostId ? "Meeting point" : fresh ? "Live" : "Away"}
                    </p>
                  </div>
                  {distanceMeters !== null && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-extrabold text-primary">{formatDistance(distanceMeters)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">{formatDuration(distanceMeters / 1.3)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
          <button
            onClick={handleLeave}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-danger text-sm font-bold text-danger active:scale-95 transition-transform"
          >
            <LogOut className="h-4 w-4" /> Leave group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Meet</h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">Set a meeting point and see everyone&apos;s live ETA.</p>

      <div className="mt-6 flex gap-2 rounded-2xl bg-secondary p-1">
        <button
          onClick={() => setTab("create")}
          className={`h-12 flex-1 rounded-xl text-sm font-bold transition-colors ${
            tab === "create" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Create
        </button>
        <button
          onClick={() => setTab("join")}
          className={`h-12 flex-1 rounded-xl text-sm font-bold transition-colors ${
            tab === "join" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Join
        </button>
      </div>

      {tab === "create" ? (
        <div className="mt-8 flex-1">
          <div className="rounded-3xl bg-secondary p-5">
            <p className="text-sm font-bold text-foreground">How it works</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              You become the meeting point. Share the code — everyone who joins sees live distance and ETA to you.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex-1">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={8}
            className="h-16 w-full rounded-2xl border-2 border-input bg-background px-4 text-center text-2xl font-extrabold tracking-[0.3em] text-foreground outline-none focus:border-primary"
          />
        </div>
      )}

      <button
        onClick={tab === "create" ? handleCreate : handleJoin}
        disabled={!position || (tab === "join" && joinCode.trim().length < 4)}
        className="h-16 w-full rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
      >
        {tab === "create" ? "Start Meeting" : "Join Meeting"}
      </button>
      {!position && <p className="mt-3 text-center text-xs font-semibold text-warning">Waiting for GPS signal…</p>}
    </div>
  );
}
