"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Motorbike, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useAuthStore } from "@/features/auth/store";
import { registerDriver } from "@/lib/api";
import type { RideCategory } from "@/types/api";

const CATEGORIES: { id: RideCategory; label: string; icon: typeof Car }[] = [
  { id: "economy", label: "Economy car", icon: Car },
  { id: "xl", label: "XL car", icon: Car },
  { id: "motorcycle", label: "Motorcycle", icon: Motorbike },
  { id: "delivery", label: "Delivery", icon: Package },
];

export default function DriverRegisterPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);

  const [category, setCategory] = useState<RideCategory>("economy");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = vehicleModel.trim() && vehicleColor.trim() && licensePlate.trim();

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await registerDriver({
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        licensePlate: licensePlate.trim().toUpperCase(),
        vehicleCategory: category,
      });
      await hydrate();
      toast.success("You're registered — go online when you're ready to drive");
      router.replace("/driver");
    } catch {
      toast.error("Couldn't register — try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <h1 className="text-2xl font-extrabold text-foreground">Become a Kaalay driver</h1>
      <p className="mt-1 text-sm font-medium text-muted-foreground">Tell us about your vehicle to start accepting rides.</p>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition-all ${
              category === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <Field label="Vehicle model" placeholder="e.g. Toyota Probox" value={vehicleModel} onChange={setVehicleModel} />
        <Field label="Vehicle color" placeholder="e.g. White" value={vehicleColor} onChange={setVehicleColor} />
        <Field label="License plate" placeholder="e.g. KDA 123A" value={licensePlate} onChange={setLicensePlate} />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className="mt-8 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
      >
        {submitting ? "Registering…" : "Register as a driver"}
      </button>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-14 rounded-2xl text-base font-semibold"
      />
    </div>
  );
}
