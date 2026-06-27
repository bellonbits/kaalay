import { create } from "zustand";
import type { Position } from "./useGeolocation";

interface LocationState {
  position: Position | null;
  /** Road-snapped refinement of `position` when on a road, else equal to `position`.
   * Map screens should read this for the "me" marker — see useRoadSnap. */
  displayPosition: Position | null;
  /** what3words address for the current GPS fix (resolved async, cached here). */
  currentWords: string | null;
  setPosition: (position: Position | null) => void;
  setDisplayPosition: (position: Position | null) => void;
  setCurrentWords: (words: string | null) => void;
}

/**
 * A single GPS watch is started once (in AppShell, via useGeolocation) and
 * mirrored here so every screen can read the live position without each
 * mounting its own watchPosition — avoids redundant GPS polling/battery
 * drain across Navigate, SOS, Meet, and Share all needing the same fix.
 */
export const useLocationStore = create<LocationState>((set) => ({
  position: null,
  displayPosition: null,
  currentWords: null,
  setPosition: (position) => set({ position }),
  setDisplayPosition: (displayPosition) => set({ displayPosition }),
  setCurrentWords: (currentWords) => set({ currentWords }),
}));
