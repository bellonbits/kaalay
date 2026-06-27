"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Mic, MapPin, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="gradient-welcome flex h-full w-full flex-col px-6 pb-10 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col justify-center gap-8"
      >
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground">
          Go anywhere
          <br />
          you want
        </h1>

        {/* Decorative search-bar preview, matching the reference */}
        <div className="rounded-3xl bg-white/90 p-4 shadow-xl backdrop-blur">
          <div className="flex h-12 items-center gap-3 rounded-2xl bg-secondary px-4">
            <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-semibold text-muted-foreground">Where to?</span>
            <Mic className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Recents
          </div>
          <div className="mt-2 flex gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-secondary p-2 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-foreground">Saved spots</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary p-2 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emergency/15">
                <ShieldAlert className="h-4 w-4 text-emergency" />
              </div>
              <span className="text-xs font-bold text-foreground">SOS ready</span>
            </div>
          </div>
        </div>

        <p className="max-w-xs text-base font-medium text-muted-foreground">
          Precision location, navigation, and emergency help — built for Africa.
        </p>
      </motion.div>

      <div className="flex w-full flex-col gap-3">
        <Button size="lg" className="h-14 rounded-2xl text-base font-bold" onClick={() => router.push("/auth?intent=signup")}>
          Get started
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 rounded-2xl border-2 bg-white/70 text-base font-bold backdrop-blur"
          onClick={() => router.push("/auth?intent=login")}
        >
          I already have an account
        </Button>
      </div>
    </div>
  );
}
