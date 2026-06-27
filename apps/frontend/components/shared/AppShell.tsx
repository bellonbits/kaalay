"use client";
import { useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { GoogleMapsProvider } from "./GoogleMapsProvider";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/features/auth/store";
import BottomNav from "./BottomNav";
import LocationWatcher from "./LocationWatcher";

export default function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleMapsProvider>
        {user && <LocationWatcher />}
        <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
          <main className="relative w-full flex-1 overflow-hidden">{children}</main>
          <BottomNav />
        </div>
        <Toaster position="top-center" />
      </GoogleMapsProvider>
    </QueryClientProvider>
  );
}
