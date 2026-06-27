import type { EmergencySeverity } from "@/types/api";

// Kaaley Heedhe severity scale — Green (lowest) through Black (life
// threatening). Colors pull from the Kaalay design system's status tokens
// where they line up (success/warning/danger), plus two more for orange
// and black since the 5-tier scale needs more granularity than the base
// 3-tier success/warning/danger system provides.
export const SEVERITY_COLORS: Record<EmergencySeverity, { hex: string; bgSoft: string; label: string }> = {
  green: { hex: "#22C55E", bgSoft: "rgba(34, 197, 94, 0.12)", label: "Low" },
  yellow: { hex: "#F59E0B", bgSoft: "rgba(245, 158, 11, 0.14)", label: "Medium" },
  orange: { hex: "#F97316", bgSoft: "rgba(249, 115, 22, 0.14)", label: "High" },
  red: { hex: "#EF4444", bgSoft: "rgba(239, 68, 68, 0.14)", label: "Critical" },
  black: { hex: "#0F172A", bgSoft: "rgba(15, 23, 42, 0.12)", label: "Extreme" },
};

export function severityColor(severity?: string | null) {
  return SEVERITY_COLORS[(severity as EmergencySeverity) ?? "yellow"] ?? SEVERITY_COLORS.yellow;
}
