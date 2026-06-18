import type { Place } from "@/types/api";
import { resolveUploadUrl } from "@/lib/api";
import type { GooglePlaceDetail } from "./googlePlaces";

export interface LocationPoint {
  lat: number;
  lng: number;
  /** Display label — usually a Kaalay location code ("NRB-4K9PX2W8") or place name. */
  label: string;
  words?: string;
  /** Set only when this point is a Kaalay community Place — lets /navigate/route
   * pull in road conditions and community notes for the destination. */
  placeId?: string;
}

/** Unified shape for the place-detail card, whether the place came from
 * Kaalay's own community Place registry or from Google Places. */
export interface DetailPlace {
  source: "kaalay" | "google";
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** what3words — only ever set for Kaalay-sourced places. */
  words?: string;
  /** Full street address — only ever set for Google-sourced places. */
  address?: string;
  description?: string | null;
  photos: string[];
  tags: string[];
  isOpenNow: boolean | null;
  rating?: number;
}

export function kaalayPlaceToDetail(p: Place): DetailPlace {
  return {
    source: "kaalay",
    id: p.id,
    name: p.name,
    lat: p.latitude,
    lng: p.longitude,
    words: p.words,
    description: p.description,
    photos: (p.photos ?? []).map(resolveUploadUrl),
    tags: p.tags ?? [],
    isOpenNow: p.isOpenNow,
    rating: p.averageRating ?? undefined,
  };
}

export function googlePlaceToDetail(g: GooglePlaceDetail): DetailPlace {
  return {
    source: "google",
    id: g.placeId,
    name: g.name,
    lat: g.lat,
    lng: g.lng,
    address: g.address,
    photos: g.photoUrls,
    tags: g.types,
    isOpenNow: g.isOpenNow,
    rating: g.rating,
  };
}
