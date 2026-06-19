"use client";
import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Compass, Route, Users, ShieldAlert, User, LayoutDashboard, Wallet } from "lucide-react";
import { useNavigationStore } from "@/features/navigation/store";
import { useLocationStore } from "@/features/location/store";
import { useAuthStore } from "@/features/auth/store";
import { triggerEmergencySos } from "@/lib/api";

// Uber/Bolt/Waze-style IA: the map is Home, safety tools (SOS/Share/Meet)
// live in Profile instead of a main tab — see app/profile/page.tsx.
const RIDER_TABS = [
  { label: "Map", icon: Map, path: "/navigate", raised: false },
  { label: "Discover", icon: Compass, path: "/discover", raised: false },
  { label: "Routes", icon: Route, path: "/routes", raised: false },
  { label: "Community", icon: Users, path: "/community", raised: false },
  { label: "Profile", icon: User, path: "/profile", raised: false },
] as const;

// Drivers and admins get their own apps, not the rider's navigation tools.
const DRIVER_TABS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/driver", raised: false },
  { label: "Earnings", icon: Wallet, path: "/driver/earnings", raised: false },
  { label: "SOS", icon: ShieldAlert, path: "/sos", raised: true },
  { label: "Profile", icon: User, path: "/profile", raised: false },
] as const;

const ADMIN_TABS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin", raised: false },
  { label: "Profile", icon: User, path: "/profile", raised: false },
] as const;

const OPERATOR_TABS = [
  { label: "Incidents", icon: ShieldAlert, path: "/operator", raised: false },
  { label: "Profile", icon: User, path: "/profile", raised: false },
] as const;

const HIDDEN_ON = ["/", "/welcome", "/auth", "/onboarding"];
const LONG_PRESS_MS = 650;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const immersive = useNavigationStore((s) => s.immersive);
  const position = useLocationStore((s) => s.position);
  const role = useAuthStore((s) => s.user?.role);

  const TABS =
    role === "admin" ? ADMIN_TABS
    : role === "driver" ? DRIVER_TABS
    : role === "emergency_operator" ? OPERATOR_TABS
    : RIDER_TABS;

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Silent SOS: holding the SOS tab anywhere in the app fires an alert
  // immediately — no navigation, no visible confirmation beyond a brief
  // vibration, per the spec's "no sound, no visible indication" requirement.
  const fireSilentSos = useCallback(() => {
    if (!position) return;
    triggerEmergencySos({
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      heading: position.heading,
      type: "violence",
      severity: "black",
      silent: true,
    }).catch(() => {});
    if (navigator.vibrate) navigator.vibrate(60);
  }, [position]);

  const handleSosPointerDown = useCallback(() => {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      fireSilentSos();
    }, LONG_PRESS_MS);
  }, [fireSilentSos]);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleSosClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    router.push("/sos");
  }, [router]);

  const hardHidden = HIDDEN_ON.some((p) => pathname === p) || pathname.startsWith("/track") || pathname.includes("/chat");
  if (hardHidden) return null;

  return (
    <AnimatePresence>
      {!immersive && (
        <motion.nav
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Primary navigation"
        >
          <div className="mx-auto flex h-20 max-w-md items-end justify-around px-2 pb-2">
            {TABS.map((tab) => {
              const active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
              const Icon = tab.icon;

              if (tab.raised) {
                return (
                  <button
                    key={tab.path}
                    onPointerDown={handleSosPointerDown}
                    onPointerUp={clearPressTimer}
                    onPointerLeave={clearPressTimer}
                    onPointerCancel={clearPressTimer}
                    onClick={handleSosClick}
                    aria-label="SOS — Emergency. Tap to open, hold for a silent alert."
                    className="-mt-7 flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-full bg-emergency text-emergency-foreground shadow-lg ring-4 ring-background active:scale-95 transition-transform"
                  >
                    <Icon className="h-7 w-7" strokeWidth={2.25} />
                    <span className="text-[9px] font-extrabold uppercase tracking-wide">SOS</span>
                  </button>
                );
              }

              return (
                <button
                  key={tab.path}
                  onClick={() => router.push(tab.path)}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 active:scale-95 transition-transform"
                  aria-current={active ? "page" : undefined}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-colors ${active ? "bg-primary/10" : ""}`}
                  >
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={active ? 2.4 : 1.8}
                      color={active ? "var(--primary)" : "var(--muted-foreground)"}
                    />
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
