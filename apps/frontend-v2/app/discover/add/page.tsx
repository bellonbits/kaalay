"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import MapBase from "@/components/shared/MapBase";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { convertToWords, createPlace, uploadImage } from "@/lib/api";

type Step = "pin" | "details";

export default function AddLocationPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState<{ lat: number; lng: number; words?: string } | null>(
    position ? { lat: position.lat, lng: position.lng } : null,
  );
  const [resolvingPin, setResolvingPin] = useState(false);
  const lastResolvedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCenterChange = (lat: number, lng: number) => {
    setPin({ lat, lng });
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (key === lastResolvedRef.current) return;
      setResolvingPin(true);
      try {
        const res = await convertToWords(lat, lng);
        lastResolvedRef.current = key;
        setPin({ lat, lng, words: res.words });
      } finally {
        setResolvingPin(false);
      }
    }, 450);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handlePickPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, 6 - photos.length)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!pin || !name.trim()) return;
    setSaving(true);
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploading(true);
        photoUrls = await Promise.all(photos.map(({ file }) => uploadImage(file).then((r) => r.url)));
        setUploading(false);
      }
      const place = await createPlace({
        name: name.trim(),
        description: description.trim() || undefined,
        lat: pin.lat,
        lng: pin.lng,
        words: pin.words ?? "",
        tags,
        photos: photoUrls,
      });
      toast.success("Place added — thanks for mapping it");
      router.push(`/place/${place.id}`);
    } catch {
      toast.error("Couldn't save this place — try again");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (!ready) return null;

  if (step === "pin") {
    return (
      <div className="relative h-full w-full">
        <MapBase
          pickingMode
          onCenterChange={handleCenterChange}
          initialCenter={pin ?? position ?? undefined}
        />

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
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Drop the pin</p>
          <p className="mt-1 truncate text-lg font-extrabold text-foreground">
            {resolvingPin ? "Locating…" : pin?.words ?? "Move the map to set the spot"}
          </p>
          <button
            onClick={() => setStep("details")}
            disabled={!pin}
            className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            Use this location
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <button
          onClick={() => setStep("pin")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back to pin"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <p className="text-lg font-extrabold text-foreground">Add this place</p>
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" /> {pin?.words}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Photos</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary active:scale-95 transition-transform"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground">Add</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handlePickPhotos(e.target.files)}
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amina's Shop"
          className="mt-2 h-12 w-full rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Description &amp; landmark</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "Green gate next to the water tank, after the petrol station turn left"'
          className="mt-2 h-24 w-full resize-none rounded-2xl bg-secondary p-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
              {t.replace(/_/g, " ")}
              <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="market, shop, school…"
            className="h-11 flex-1 rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={addTag}
            disabled={!tagInput.trim()}
            className="h-11 flex-shrink-0 rounded-2xl bg-secondary px-4 text-sm font-bold text-foreground disabled:opacity-40"
          >
            Add
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="mt-8 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
        >
          {uploading ? "Uploading photos…" : saving ? "Saving…" : "Save place"}
        </button>
      </div>
    </div>
  );
}
