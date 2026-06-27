"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Compass, ShieldAlert, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

const SLIDES = [
  {
    icon: Compass,
    title: "Find places, precisely",
    body: "Navigate to any spot with turn-by-turn directions and a location code that's exact down to the metre.",
  },
  {
    icon: ShieldAlert,
    title: "Stay safe, always",
    body: "One tap SOS, live location sharing with people you trust, and the nearest safe zones whenever you need them.",
  },
  {
    icon: Car,
    title: "Ride with confidence",
    body: "Book a ride by hand or just tell our AI where you're headed — track your driver live until you arrive.",
  },
];

const SWIPE_THRESHOLD = 60;

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const finish = () => {
    localStorage.setItem("kaalay_onboarded", "1");
    router.replace("/welcome");
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      if (index === SLIDES.length - 1) finish();
      else goTo(index + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      goTo(index - 1);
    }
  };

  const slide = SLIDES[index];
  const Icon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="flex h-full w-full flex-col bg-background px-6 pb-10 pt-16">
      <button
        onClick={finish}
        className="self-end text-sm font-bold text-muted-foreground active:scale-95 transition-transform"
      >
        Skip
      </button>

      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="absolute h-28 w-28 rounded-[2.25rem] bg-primary/10" />
              <div className="absolute h-20 w-20 -translate-x-3 -translate-y-3 rounded-full bg-primary/15" />
              <Icon className="relative h-14 w-14 text-primary" strokeWidth={1.75} />
              <div className="absolute bottom-3 h-2.5 w-14 rounded-full bg-foreground/10 blur-[2px]" />
            </div>
            <h1 className="mt-10 text-3xl font-extrabold tracking-tight text-foreground">{slide.title}</h1>
            <p className="mt-4 max-w-xs text-base font-medium leading-relaxed text-muted-foreground">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-primary" : "w-2 bg-secondary"}`}
          />
        ))}
      </div>

      <Button
        size="lg"
        className="mt-8 h-14 w-full rounded-2xl text-base font-bold"
        onClick={() => (isLast ? finish() : goTo(index + 1))}
      >
        {isLast ? "Get started" : "Next"}
      </Button>
    </div>
  );
}
