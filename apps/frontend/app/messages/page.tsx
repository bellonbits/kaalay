"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Car, ChevronRight } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { getRideHistory } from "@/lib/api";
import type { Ride, RideStatus } from "@/types/api";

const ACTIVE_STATUSES: RideStatus[] = ["accepted", "arriving", "arrived", "started"];

export default function MessagesPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  useEffect(() => {
    getRideHistory()
      .then((rides) => setActiveRide(rides.find((r) => ACTIVE_STATUSES.includes(r.status)) ?? null))
      .catch(() => {});
  }, []);

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <button
          onClick={() => router.push("/navigate")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <p className="text-lg font-extrabold text-foreground">Messages</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/assistant")}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-foreground">Kaalay Assistant</p>
              <p className="truncate text-xs font-medium text-muted-foreground">Find a destination, ask anything</p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </button>

          {activeRide && (
            <button
              onClick={() => router.push(`/ride/${activeRide.id}/chat`)}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-foreground">{activeRide.driver?.fullName ?? "Your driver"}</p>
                <p className="truncate text-xs font-medium text-muted-foreground">Active trip — tap to chat</p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>

        {!activeRide && (
          <p className="mt-6 text-center text-xs font-medium text-muted-foreground">
            Driver chat appears here once a ride is accepted.
          </p>
        )}
      </div>
    </div>
  );
}
