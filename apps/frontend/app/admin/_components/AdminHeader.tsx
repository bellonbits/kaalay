"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AdminHeader({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
      {back && (
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
        {subtitle && <p className="truncate text-xs font-semibold text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
