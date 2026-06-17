"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./store";
import type { UserRole } from "@/types/api";

/**
 * Like useRequireAuth, but also redirects away if the signed-in user's role
 * doesn't match — used to keep riders out of /admin/* (there's no
 * self-service way to become an admin, unlike /driver/*, which a rider is
 * meant to be able to reach to register a vehicle).
 */
export function useRequireRole(role: UserRole) {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    if (user.role !== role) router.replace("/navigate");
  }, [hydrated, user, role, router]);

  return { user, ready: hydrated && !!user && user.role === role };
}
