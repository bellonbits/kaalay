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
  /** When true, /navigate/route skips the mode-select screen and starts
   * navigating in the first available mode the instant estimates resolve —
   * the "Start" action from a place's detail sheet ("Directions" leaves
   * this false so the user picks a mode). */
  autoStart: boolean;
  setAutoStart: (autoStart: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
  destination: null,
  setDestination: (destination) => set({ destination }),
  autoStart: false,
  setAutoStart: (autoStart) => set({ autoStart }),
}));
