"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { homeRouteForRole, useAuthStore } from "@/features/auth/store";

export default function SplashPage() {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      router.replace(user ? homeRouteForRole(user.role) : "/welcome");
    }, 900);
    return () => clearTimeout(t);
  }, [hydrated, user, router]);

  return (
    <div className="gradient-welcome flex h-full w-full flex-col items-center justify-center gap-8 px-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary shadow-lg"
      >
        <Compass className="h-12 w-12 text-primary-foreground" strokeWidth={2} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Kaalay</h1>
        <p className="mt-3 text-lg font-medium leading-snug text-muted-foreground">
          Find People.
          <br />
          Find Places.
          <br />
          Find Help.
        </p>
      </motion.div>
    </div>
  );
}
