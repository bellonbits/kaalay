"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import RideChatScreen from "@/features/ride/components/RideChatScreen";
import { getRide } from "@/lib/api";
import type { Ride } from "@/types/api";

export default function DriverRideChatPage() {
  const { ready, user } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const rideId = params.id;
  const [ride, setRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (!rideId) return;
    getRide(rideId).then(setRide).catch(() => {});
  }, [rideId]);

  if (!ready || !user || !ride) return null;

  return (
    <RideChatScreen
      rideId={ride.id}
      currentUserId={user.id}
      peerLabel={ride.rider?.fullName ? `Chat with ${ride.rider.fullName}` : "Chat with rider"}
      backHref={`/driver/ride/${ride.id}`}
    />
  );
}
