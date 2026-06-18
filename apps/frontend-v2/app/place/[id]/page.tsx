"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Star, Navigation as NavIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useNavigationStore } from "@/features/navigation/store";
import {
  getPlace,
  getPlaceReviews,
  createPlaceReview,
  getPlaceNotes,
  createPlaceNote,
  recordPlaceVisit,
  getNearbyPlaces,
  resolveUploadUrl,
} from "@/lib/api";
import { addRecent } from "@/features/navigation/recents";
import type { Place, PlaceReview, PlaceNote } from "@/types/api";

export default function PlaceDetailPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const placeId = params.id;
  const setDestination = useNavigationStore((s) => s.setDestination);

  const [place, setPlace] = useState<Place | null>(null);
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [notes, setNotes] = useState<PlaceNote[]>([]);
  const [nearby, setNearby] = useState<Place[]>([]);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    getPlace(placeId).then(setPlace).catch(() => toast.error("Couldn't load this place"));
    getPlaceReviews(placeId).then(setReviews).catch(() => {});
    getPlaceNotes(placeId).then(setNotes).catch(() => {});
    recordPlaceVisit(placeId).catch(() => {});
  }, [placeId]);

  useEffect(() => {
    if (!place) return;
    getNearbyPlaces(place.latitude, place.longitude, 1)
      .then((list) => setNearby(list.filter((p) => p.id !== place.id).slice(0, 6)))
      .catch(() => {});
  }, [place]);

  const handleDirections = () => {
    if (!place) return;
    addRecent({
      kind: "place",
      key: `kaalay-${place.id}`,
      place: {
        source: "kaalay",
        id: place.id,
        name: place.name,
        lat: place.latitude,
        lng: place.longitude,
        words: place.words,
        photos: place.photos.map(resolveUploadUrl),
        tags: place.tags,
        isOpenNow: place.isOpenNow,
        rating: place.averageRating ?? undefined,
      },
    });
    setDestination({ lat: place.latitude, lng: place.longitude, label: place.name, words: place.words, placeId: place.id });
    router.push("/navigate/route");
  };

  const handleSubmitReview = async () => {
    if (!placeId || reviewRating === 0) return;
    setSubmittingReview(true);
    try {
      await createPlaceReview(placeId, reviewRating, reviewComment.trim() || undefined);
      const [updatedPlace, updatedReviews] = await Promise.all([getPlace(placeId), getPlaceReviews(placeId)]);
      setPlace(updatedPlace);
      setReviews(updatedReviews);
      setReviewRating(0);
      setReviewComment("");
      toast.success("Review posted");
    } catch {
      toast.error("Couldn't post your review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!placeId || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const note = await createPlaceNote(placeId, noteText.trim());
      setNotes((prev) => [note, ...prev]);
      setNoteText("");
    } catch {
      toast.error("Couldn't post your note");
    } finally {
      setSubmittingNote(false);
    }
  };

  if (!ready || !place) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="relative h-56 w-full flex-shrink-0 bg-secondary">
        {place.photos.length > 0 ? (
          <div className="flex h-full w-full gap-1 overflow-x-auto">
            {place.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={resolveUploadUrl(src)}
                alt={`${place.name} photo ${i + 1}`}
                className="h-full w-full flex-shrink-0 object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-lg active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-5">
        <h1 className="text-2xl font-extrabold text-foreground">{place.name}</h1>
        <div className="mt-1 flex items-center gap-3">
          {place.averageRating && (
            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Star className="h-4 w-4 fill-warning text-warning" /> {place.averageRating} ({place.reviewCount})
            </span>
          )}
          <span className="text-xs font-semibold text-muted-foreground">{place.visitCount} visits</span>
          {place.isOpenNow !== null && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                place.isOpenNow ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              {place.isOpenNow ? "Open now" : "Closed"}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm font-bold text-primary">{place.words}</p>
        {place.description && (
          <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">{place.description}</p>
        )}
        {place.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleDirections}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform"
        >
          <NavIcon className="h-5 w-5" /> Directions
        </button>

        <p className="mt-8 text-sm font-extrabold text-foreground">Community guidance</p>
        <p className="text-xs font-medium text-muted-foreground">The last-meter directions a map alone can&apos;t give you.</p>
        <div className="mt-3 flex flex-col gap-2">
          {notes.length === 0 && <p className="text-xs font-medium text-muted-foreground">No notes yet — add the first one.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-2xl bg-secondary p-3">
              <p className="text-sm font-medium text-foreground">{n.text}</p>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{n.userName ?? "Someone nearby"}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder='e.g. "Blue gate beside the school"'
            className="h-12 flex-1 rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={handleSubmitNote}
            disabled={!noteText.trim() || submittingNote}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-8 text-sm font-extrabold text-foreground">Reviews</p>
        <div className="mt-3 flex flex-col gap-2">
          {reviews.length === 0 && <p className="text-xs font-medium text-muted-foreground">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl bg-secondary p-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                ))}
              </div>
              {r.comment && <p className="mt-1 text-sm font-medium text-foreground">{r.comment}</p>}
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{r.userName ?? "Someone"}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-secondary p-4">
          <p className="text-xs font-bold text-foreground">Leave a review</p>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setReviewRating(n)} aria-label={`${n} stars`}>
                <Star className={`h-7 w-7 ${n <= reviewRating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Optional comment"
            className="mt-3 h-16 w-full resize-none rounded-xl bg-card p-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={handleSubmitReview}
            disabled={reviewRating === 0 || submittingReview}
            className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
          >
            {submittingReview ? "Posting…" : "Post review"}
          </button>
        </div>

        {nearby.length > 0 && (
          <>
            <p className="mt-8 text-sm font-extrabold text-foreground">Nearby landmarks</p>
            <div className="mt-3 flex flex-col gap-2">
              {nearby.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/place/${p.id}`)}
                  className="flex items-center gap-3 rounded-2xl bg-secondary p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="truncate text-sm font-bold text-foreground">{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
