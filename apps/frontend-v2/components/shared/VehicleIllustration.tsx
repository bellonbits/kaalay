import { Car, Motorbike, Package } from "lucide-react";
import type { RideCategory } from "@/types/api";

// Code-generated placeholder art per ride tier — swap for real vehicle
// photography later without touching any layout that uses this component.
const ICON: Record<RideCategory, typeof Car> = {
  economy: Car,
  motorcycle: Motorbike,
  xl: Car,
  delivery: Package,
};

const STYLE: Record<RideCategory, { gradient: string; iconColor: string }> = {
  economy: { gradient: "from-primary/25 to-primary/5", iconColor: "text-primary" },
  motorcycle: { gradient: "from-warning/25 to-warning/5", iconColor: "text-warning" },
  xl: { gradient: "from-blue-500/25 to-blue-500/5", iconColor: "text-blue-500" },
  delivery: { gradient: "from-violet-500/25 to-violet-500/5", iconColor: "text-violet-500" },
};

export default function VehicleIllustration({ category, className }: { category: RideCategory; className?: string }) {
  const Icon = ICON[category];
  const { gradient, iconColor } = STYLE[category];
  return (
    <div className={`flex flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} ${className ?? "h-16 w-16"}`}>
      <Icon className={`h-8 w-8 ${iconColor}`} strokeWidth={1.5} />
    </div>
  );
}
