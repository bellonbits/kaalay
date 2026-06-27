"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./store";

/** Redirects to /welcome once auth state is known and there's no user. */
export function useRequireAuth() {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (hydrated && !user) router.replace("/welcome");
  }, [hydrated, user, router]);

  return { user, ready: hydrated && !!user };
}
