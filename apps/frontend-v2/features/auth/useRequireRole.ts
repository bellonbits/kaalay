"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./store";
import type { UserRole } from "@/types/api";

/**
 * Like useRequireAuth, but also redirects away if the signed-in user's role
 * doesn't match one of `allowed` — used to keep riders out of /admin/* and
 * /operator/* (there's no self-service way to become an admin or emergency
 * operator, unlike /driver/*, which a rider is meant to be able to reach to
 * register a vehicle). Pass an array when more than one role should be let
 * in — e.g. /operator/* allows both "emergency_operator" and "admin".
 */
export function useRequireRole(allowed: UserRole | UserRole[]) {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    if (!roles.includes(user.role)) router.replace("/navigate");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, router, roles.join(",")]);

  return { user, ready: hydrated && !!user && roles.includes(user.role) };
}
