import { create } from "zustand";
import type { LocationPoint } from "./types";

export type TravelMode = "WALKING" | "BICYCLING" | "DRIVING" | "PRECISION";

interface NavigationState {
  /** True while turn-by-turn is active — drives BottomNav/chrome hiding via
   * a store flag instead of the old app's window CustomEvent pattern. */
  immersive: boolean;
  setImmersive: (immersive: boolean) => void;
  /** Destination chosen on /navigate, read by /navigate/route to plan the trip. */
  destination: LocationPoint | null;
  setDestination: (point: LocationPoint | null) => void;
  /** Optional custom starting point — null means "use live GPS position".
   * Settable from the Home plan-a-trip sheet or edited directly on
   * /navigate/route; persisted here (not local state) so both screens agree. */
  origin: LocationPoint | null;
  setOrigin: (point: LocationPoint | null) => void;
  /** When true, /navigate/route skips the mode-select screen and starts
   * navigating in the first available mode the instant estimates resolve —
   * the "Start" action from a place's detail sheet ("Directions" leaves
   * this false so the user picks a mode). */
  autoStart: boolean;
  setAutoStart: (autoStart: boolean) => void;
  /** Polyline of the trip just finished in /navigate/route — read by
   * /routes/create to offer "share this trip as a guide" right after arrival. */
  lastCompletedRoute: { points: { lat: number; lng: number }[]; distanceKm: number | null; endLabel: string } | null;
  setLastCompletedRoute: (route: NavigationState["lastCompletedRoute"]) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
  destination: null,
  setDestination: (destination) => set({ destination }),
  origin: null,
  setOrigin: (origin) => set({ origin }),
  autoStart: false,
  setAutoStart: (autoStart) => set({ autoStart }),
  lastCompletedRoute: null,
  setLastCompletedRoute: (lastCompletedRoute) => set({ lastCompletedRoute }),
}));
