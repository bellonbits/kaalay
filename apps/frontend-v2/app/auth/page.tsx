"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Phone, User as UserIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/features/auth/store";

function AuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") === "login" ? "login" : "signup";
  const { requestLogin, register, loading } = useAuthStore();

  const [step, setStep] = useState<"phone" | "register">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneValid = phoneNumber.replace(/\D/g, "").length >= 9;

  const handlePhoneSubmit = async () => {
    if (!phoneValid) {
      setError("Enter a valid phone number");
      return;
    }
    setError(null);
    try {
      const { isNewUser } = await requestLogin(phoneNumber.trim());
      if (isNewUser) {
        setStep("register");
      } else {
        router.replace("/navigate");
      }
    } catch {
      setError("Couldn't reach Kaalay. Check your connection and try again.");
    }
  };

  const handleRegisterSubmit = async () => {
    if (!fullName.trim()) {
      setError("Tell us your name");
      return;
    }
    setError(null);
    try {
      await register({ phoneNumber: phoneNumber.trim(), fullName: fullName.trim(), email: email.trim() || undefined });
      router.replace("/navigate");
    } catch {
      setError("Couldn't create your account. Try again.");
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background px-6 pb-10 pt-14">
      <button
        onClick={() => (step === "register" ? setStep("phone") : router.push("/welcome"))}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>

      <div className="mt-8 flex-1">
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {intent === "login" ? "Welcome back" : "Let's get started"}
              </h1>
              <p className="mt-2 text-base font-medium text-muted-foreground">
                Enter your phone number — no password needed.
              </p>

              <div className="mt-8 space-y-2">
                <Label htmlFor="phone" className="text-sm font-bold text-foreground">
                  Phone number
                </Label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-input bg-background px-4 h-14">
                  <Phone className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoFocus
                    placeholder="+254 7XX XXX XXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                    className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}

              <Button
                size="lg"
                className="mt-8 h-14 w-full rounded-2xl text-base font-bold"
                onClick={handlePhoneSubmit}
                disabled={loading || !phoneValid}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Create your account</h1>
              <p className="mt-2 text-base font-medium text-muted-foreground">Just a couple details and you&apos;re in.</p>

              <div className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-bold text-foreground">
                    Full name
                  </Label>
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-input bg-background px-4 h-14">
                    <UserIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <Input
                      id="fullName"
                      autoFocus
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold text-foreground">
                    Email <span className="font-medium text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-input bg-background px-4 h-14">
                    <Mail className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegisterSubmit()}
                      className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}

              <Button
                size="lg"
                className="mt-8 h-14 w-full rounded-2xl text-base font-bold"
                onClick={handleRegisterSubmit}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthFlow />
    </Suspense>
  );
}
