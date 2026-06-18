import { Car, Motorbike, Bus, Package, Bike } from "lucide-react";
import type { RideCategory } from "@/types/api";

// Code-generated placeholder art per ride tier — a layered icon-on-a-blob
// treatment (background shape + icon + grounded shadow) standing in for
// real vehicle photography/illustration later, without touching any layout
// that uses this component.
const ICON: Record<RideCategory, typeof Car> = {
  economy: Car,
  motorcycle: Motorbike,
  xl: Bus,
  delivery: Package,
  bike: Bike,
};

const STYLE: Record<RideCategory, { gradient: string; iconColor: string }> = {
  economy: { gradient: "from-primary/25 to-primary/5", iconColor: "text-primary" },
  motorcycle: { gradient: "from-warning/25 to-warning/5", iconColor: "text-warning" },
  xl: { gradient: "from-blue-500/25 to-blue-500/5", iconColor: "text-blue-500" },
  delivery: { gradient: "from-violet-500/25 to-violet-500/5", iconColor: "text-violet-500" },
  bike: { gradient: "from-success/25 to-success/5", iconColor: "text-success" },
};

export default function VehicleIllustration({ category, className }: { category: RideCategory; className?: string }) {
  const Icon = ICON[category];
  const { gradient, iconColor } = STYLE[category];
  return (
    <div className={`relative flex flex-shrink-0 items-center justify-center ${className ?? "h-16 w-16"}`}>
      <div className={`absolute inset-0 rounded-[1.25rem] bg-gradient-to-br ${gradient}`} />
      <Icon className={`relative h-8 w-8 -translate-y-0.5 ${iconColor}`} strokeWidth={1.5} />
      <div className="absolute bottom-1.5 h-1.5 w-7 rounded-full bg-foreground/10 blur-[1.5px]" />
    </div>
  );
}
