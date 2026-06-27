import { Ambulance, Shield, Flame, TriangleAlert, Siren, AlertOctagon } from "lucide-react";
import type { EmergencySeverity, EmergencyType } from "@/types/api";

export const SOS_CATEGORIES: {
  type: EmergencyType;
  label: string;
  icon: typeof Ambulance;
  defaultSeverity: EmergencySeverity;
}[] = [
  { type: "medical", label: "Medical", icon: Ambulance, defaultSeverity: "orange" },
  { type: "police", label: "Police", icon: Shield, defaultSeverity: "orange" },
  { type: "fire", label: "Fire", icon: Flame, defaultSeverity: "red" },
  { type: "violence", label: "Violence", icon: TriangleAlert, defaultSeverity: "red" },
  { type: "kidnapping", label: "Kidnapping", icon: Siren, defaultSeverity: "black" },
  { type: "disaster", label: "Disaster", icon: AlertOctagon, defaultSeverity: "red" },
];
