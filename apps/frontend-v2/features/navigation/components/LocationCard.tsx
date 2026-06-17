"use client";
import { useState } from "react";
import { Copy, Share2, Bookmark, Navigation as NavigationIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPlace } from "@/lib/api";
import type { LocationPoint } from "../types";

interface Props {
  point: LocationPoint | null;
  accuracy?: number | null;
  resolving?: boolean;
  onNavigate: (point: LocationPoint) => void;
}

export default function LocationCard({ point, accuracy, resolving, onNavigate }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const label = point?.label ?? "Locating…";

  const handleCopy = async () => {
    if (!point) return;
    await navigator.clipboard.writeText(point.label);
    toast.success("Copied to clipboard");
  };

  const handleShare = async () => {
    if (!point) return;
    const text = `My location on Kaalay: ${point.label}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled — not an error
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied — paste it anywhere to share");
    }
  };

  const handleSave = async () => {
    if (!point || !point.words) return;
    setSaving(true);
    try {
      await createPlace({
        name: saveName.trim() || point.label,
        lat: point.lat,
        lng: point.lng,
        words: point.words,
      });
      toast.success("Saved to your places");
      setSaveOpen(false);
      setSaveName("");
    } catch {
      toast.error("Couldn't save this place");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Current spot</p>
            <p className="mt-1 truncate text-lg font-extrabold text-primary">{resolving ? "Locating…" : label}</p>
            {typeof accuracy === "number" && (
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">±{Math.round(accuracy)}m accuracy</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2.5">
          <ActionButton icon={Copy} label="Copy" onClick={handleCopy} disabled={!point} />
          <ActionButton icon={Share2} label="Share" onClick={handleShare} disabled={!point} />
          <ActionButton icon={Bookmark} label="Save" onClick={() => setSaveOpen(true)} disabled={!point?.words} />
          <ActionButton
            icon={NavigationIcon}
            label="Navigate"
            onClick={() => point && onNavigate(point)}
            disabled={!point}
            primary
          />
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Save this place</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Home, Work, Mum's house"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="h-14 rounded-2xl text-base font-semibold"
          />
          <Button size="lg" className="h-14 rounded-2xl text-base font-bold" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : (
              <>
                <Check className="h-5 w-5" /> Save Place
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-bold transition-transform active:scale-95 disabled:opacity-40 ${
        primary ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
