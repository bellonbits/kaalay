import type { DetailPlace, LocationPoint } from "./types";

export type NewRecentEntry =
  | { kind: "place"; key: string; place: DetailPlace }
  | { kind: "point"; key: string; point: LocationPoint; subtitle?: string };

export type RecentEntry = NewRecentEntry & { savedAt: number };

const STORAGE_KEY = "kaalay_recent_destinations";
const MAX_RECENTS = 6;

export function getRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function addRecent(entry: NewRecentEntry) {
  if (typeof window === "undefined") return;
  const existing = getRecents().filter((r) => r.key !== entry.key);
  const next = [{ ...entry, savedAt: Date.now() }, ...existing].slice(0, MAX_RECENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
