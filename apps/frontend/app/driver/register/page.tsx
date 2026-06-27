"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Motorbike, Package, Bike, FileText, ArrowLeft, Upload, Check, Trash2 } from "lucide-react";
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
  { id: "bike", label: "Bicycle", icon: Bike },
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

  // Document Upload States
  const [nationalIdFile, setNationalIdFile] = useState<string | null>(null);
  const [nationalIdProgress, setNationalIdProgress] = useState<number | null>(null);

  const [licenseFile, setLicenseFile] = useState<string | null>(null);
  const [licenseProgress, setLicenseProgress] = useState<number | null>(null);

  const [insuranceFile, setInsuranceFile] = useState<string | null>(null);
  const [insuranceProgress, setInsuranceProgress] = useState<number | null>(null);

  const textFieldsValid = vehicleModel.trim() && vehicleColor.trim() && licensePlate.trim();
  const docsValid = !!nationalIdFile && !!licenseFile && !!insuranceFile;
  const valid = textFieldsValid && docsValid;

  const simulateUpload = (
    fileName: string,
    setProgress: (p: number | null) => void,
    setFile: (f: string | null) => void
  ) => {
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.floor(10 + Math.random() * 20);
      if (p >= 100) {
        setProgress(100);
        setFile(fileName);
        clearInterval(interval);
        toast.success(`${fileName} uploaded successfully!`);
      } else {
        setProgress(p);
      }
    }, 150);
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: "id" | "license" | "insurance"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (docType === "id") {
      simulateUpload(file.name, setNationalIdProgress, setNationalIdFile);
    } else if (docType === "license") {
      simulateUpload(file.name, setLicenseProgress, setLicenseFile);
    } else if (docType === "insurance") {
      simulateUpload(file.name, setInsuranceProgress, setInsuranceFile);
    }
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await registerDriver({
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        licensePlate: licensePlate.trim().toUpperCase(),
        vehicleCategory: category,
        nationalIdUrl: `/uploads/mock_id_${Date.now()}.pdf`,
        drivingLicenseUrl: `/uploads/mock_lic_${Date.now()}.pdf`
      });
      await hydrate();
      toast.success("Driver profile created successfully!");
      router.replace("/driver");
    } catch {
      toast.error("Couldn't register driver profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] text-left font-outfit">
      {/* Header bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-2xl font-extrabold text-foreground">Become a Kaalay Driver</h1>
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground leading-relaxed">
        Submit details about your vehicle and upload validation files to launch your driver profile.
      </p>

      {/* Rider Type Category Selector */}
      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Select Rider Category</p>
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-black transition-all border active:scale-95 ${
                category === id
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10"
                  : "bg-secondary/40 text-foreground border-transparent hover:bg-secondary/60"
              }`}
            >
              <Icon className="h-5.5 w-5.5" />
              <span className="leading-tight text-center">{label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle details inputs */}
      <div className="mt-5 flex flex-col gap-4">
        <Field label="Vehicle Model" placeholder="e.g. Toyota Probox / Honda CG 125" value={vehicleModel} onChange={setVehicleModel} />
        <Field label="Vehicle Color" placeholder="e.g. White / Silver" value={vehicleColor} onChange={setVehicleColor} />
        <Field label="License Plate" placeholder="e.g. KDA 123A / SL 4920" value={licensePlate} onChange={setLicensePlate} />
      </div>

      {/* File Upload widgets */}
      <div className="mt-6 flex flex-col gap-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Required Documents</p>
        
        {/* National ID Upload Card */}
        <UploadCard
          title="National ID Card"
          fileName={nationalIdFile}
          progress={nationalIdProgress}
          onChange={(e) => handleFileChange(e, "id")}
          onClear={() => {
            setNationalIdFile(null);
            setNationalIdProgress(null);
          }}
        />

        {/* Driving License Upload Card */}
        <UploadCard
          title="Driving License"
          fileName={licenseFile}
          progress={licenseProgress}
          onChange={(e) => handleFileChange(e, "license")}
          onClear={() => {
            setLicenseFile(null);
            setLicenseProgress(null);
          }}
        />

        {/* Insurance Cover Upload Card */}
        <UploadCard
          title="Commercial Vehicle Insurance"
          fileName={insuranceFile}
          progress={insuranceProgress}
          onChange={(e) => handleFileChange(e, "insurance")}
          onClear={() => {
            setInsuranceFile(null);
            setInsuranceProgress(null);
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className="mt-8 h-15 w-full rounded-2xl bg-primary text-base font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20"
      >
        {submitting ? "Registering profile…" : "SUBMIT REGISTRATION"}
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
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-13 rounded-xl text-sm font-semibold bg-secondary/20 border-border/40 focus:border-primary"
      />
    </div>
  );
}

interface UploadCardProps {
  title: string;
  fileName: string | null;
  progress: number | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function UploadCard({ title, fileName, progress, onChange, onClear }: UploadCardProps) {
  const isUploading = progress !== null && progress < 100;
  const isUploaded = !!fileName && progress === 100;

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs font-black text-foreground">{title}</p>
          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">PDF, PNG, JPG files accepted</p>
        </div>

        {/* Upload Trigger / File Info actions */}
        <div className="flex items-center gap-2">
          {isUploaded ? (
            <button
              type="button"
              onClick={onClear}
              className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-secondary/40 active:scale-95 transition-transform"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          ) : (
            <label className="flex h-10 px-4 items-center gap-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold cursor-pointer active:scale-95 transition-transform">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload file</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={onChange} disabled={isUploading} />
            </label>
          )}
        </div>
      </div>

      {/* Progress Bar / Thumbnail details */}
      {isUploading && (
        <div className="mt-3 flex flex-col gap-1.5 animate-fade-in">
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground leading-none">
            <span>Uploading document…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div style={{ width: `${progress}%` }} className="h-full bg-primary transition-all duration-150" />
          </div>
        </div>
      )}

      {isUploaded && (
        <div className="mt-3 rounded-xl bg-secondary/35 p-3 flex items-center gap-2 border border-emerald-500/10 animate-fade-in">
          <span className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs font-bold text-foreground truncate">{fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
