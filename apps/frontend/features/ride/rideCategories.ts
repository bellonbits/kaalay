import type { RideCategory } from "@/types/api";

/** Shared between /ride (category picker) and /ride/ai (suggested-ride card) so the two screens describe the same tiers consistently. */
export const RIDE_CATEGORY_INFO: Record<RideCategory, { label: string; description: string }> = {
  economy: { label: "Kaalay Go", description: "Affordable, everyday rides" },
  motorcycle: { label: "Kaalay Moto", description: "Fast pickup, quick trips" },
  xl: { label: "Kaalay Comfort", description: "More room, smoother ride" },
  delivery: { label: "Kaalay Premium", description: "Top-rated drivers" },
  bike: { label: "Kaalay Bike", description: "Cheapest, short trips" },
};

export const RIDE_CATEGORIES = Object.keys(RIDE_CATEGORY_INFO) as RideCategory[];
