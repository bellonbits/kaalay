import { create } from "zustand";
import type { EmergencySeverity, EmergencyType, Incident } from "@/types/api";

interface SosState {
  activeIncident: Incident | null;
  selectedType: EmergencyType | null;
  selectedSeverity: EmergencySeverity;
  setActiveIncident: (incident: Incident | null) => void;
  setSelection: (type: EmergencyType, severity: EmergencySeverity) => void;
  clear: () => void;
}

export const useSosStore = create<SosState>((set) => ({
  activeIncident: null,
  selectedType: null,
  selectedSeverity: "yellow",
  setActiveIncident: (activeIncident) => set({ activeIncident }),
  setSelection: (selectedType, selectedSeverity) => set({ selectedType, selectedSeverity }),
  clear: () => set({ activeIncident: null, selectedType: null, selectedSeverity: "yellow" }),
}));
