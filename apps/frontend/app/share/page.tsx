"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Share2, Square, Clock, Users } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useShareStore } from "@/features/share/store";
import { useSessionSocket } from "@/features/location/useSessionSocket";
import { createShareSession, updateShareSession } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const DURATIONS: { label: string; seconds: number | null }[] = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "8 hours", seconds: 8 * 60 * 60 },
  { label: "Until stopped", seconds: null },
];

export default function SharePage() {
  const { ready } = useRequireAuth();
  const position = useLocationStore((s) => s.position);
  const { activeToken, setActiveToken } = useShareStore();

  const [duration, setDuration] = useState(DURATIONS[1]);
  const [starting, setStarting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { viewerCount } = useSessionSocket(activeToken);

  useEffect(() => {
    if (!activeToken) return;
    const url = `${window.location.origin}/track/${activeToken}`;
    setShareUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQrDataUrl);
  }, [activeToken]);

  // Periodically stream host's position to socket room
  useEffect(() => {
    if (!activeToken || !position) return;
    const socket = getSocket();

    // Join room so we can broadcast
    socket.emit("join", activeToken);

    const interval = setInterval(() => {
      socket.emit("push-location", {
        code: activeToken,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
        timestamp: Date.now(),
      });
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [activeToken, position]);

  const handleStart = async () => {
    if (!position || starting) return;
    setStarting(true);
    try {
      // "Until stopped" still needs a server-side TTL — a generous one,
      // since the explicit Stop button is what actually ends it in practice.
      const expiresIn = duration.seconds ?? 7 * 24 * 60 * 60;
      const res = await createShareSession({
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        requestType: "sharing",
        visibility: "public",
        expiresIn,
      });
      setActiveToken(res.shareCode);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!activeToken) return;
    await updateShareSession(activeToken, { status: "ended" }).catch(() => {});
    setActiveToken(null);
    setShareUrl("");
    setQrDataUrl("");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `I'm sharing my live location on Kaalay: ${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  if (!ready) return null;

  if (activeToken) {
    return (
      <div className="flex h-full w-full flex-col items-center bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <span className="flex items-center gap-2 rounded-full bg-success/15 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Broadcasting live
        </span>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code to track this share" className="mt-6 h-48 w-48 rounded-2xl border-4 border-card shadow-lg" />
        )}

        <p className="mt-6 font-mono text-2xl font-extrabold tracking-widest text-foreground">{activeToken}</p>

        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" /> {viewerCount} watching
        </div>

        <div className="mt-8 flex w-full max-w-xs gap-3">
          <button
            onClick={handleCopy}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-bold text-foreground active:scale-95 transition-transform"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={handleShare}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        <button
          onClick={handleStop}
          className="mt-4 flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl border-2 border-danger text-sm font-bold text-danger active:scale-95 transition-transform"
        >
          <Square className="h-4 w-4" /> Stop sharing
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Share location</h1>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        Anyone with the link sees your live position until you stop.
      </p>

      <p className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-4 w-4" /> Duration
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {DURATIONS.map((d) => (
          <button
            key={d.label}
            onClick={() => setDuration(d)}
            className={`h-16 rounded-2xl text-sm font-bold transition-colors ${
              duration.label === d.label ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleStart}
        disabled={!position || starting}
        className="mt-auto flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
      >
        {starting ? "Starting…" : "Share Now"}
      </button>
      {!position && <p className="mt-3 text-center text-xs font-semibold text-warning">Waiting for GPS signal…</p>}
    </div>
  );
}
