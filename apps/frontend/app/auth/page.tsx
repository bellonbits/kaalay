"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Phone, User as UserIcon, Mail, Car, ShieldAlert, Motorbike, Package, Compass, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeRouteForRole, useAuthStore } from "@/features/auth/store";
import { verifyOTP } from "@/lib/api";
import type { RideCategory } from "@/types/api";

type AccountType = "rider" | "driver" | "emergency_operator";

const ACCOUNT_TYPES: { id: AccountType; label: string; icon: typeof UserIcon }[] = [
  { id: "rider", label: "Rider", icon: UserIcon },
  { id: "driver", label: "Driver", icon: Car },
  { id: "emergency_operator", label: "Emergency Operator", icon: ShieldAlert },
];

const VEHICLE_CATEGORIES: { id: RideCategory; label: string; icon: typeof Car }[] = [
  { id: "economy", label: "Economy", icon: Car },
  { id: "motorcycle", label: "Motorcycle", icon: Motorbike },
  { id: "xl", label: "XL", icon: Car },
  { id: "delivery", label: "Delivery", icon: Package },
  { id: "bike", label: "Bike", icon: Bike },
];

function AuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") === "login" ? "login" : "signup";
  const { requestLogin, register, loading } = useAuthStore();

  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("rider");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleCategory, setVehicleCategory] = useState<RideCategory>("economy");
  const [licensePlate, setLicensePlate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneValid = phoneNumber.replace(/\D/g, "").length >= 9;

  const handlePhoneSubmit = async () => {
    if (!phoneValid) {
      setError("Enter a valid phone number");
      return;
    }
    setError(null);
    try {
      await requestLogin(phoneNumber.trim());
      setStep("otp");
    } catch {
      setError("Couldn't send OTP. Check your connection and try again.");
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpCode.trim() || otpCode.length < 4) {
      setError("Enter a valid OTP");
      return;
    }
    setError(null);
    try {
      const { user, accessToken, refreshToken } = await verifyOTP(phoneNumber, otpCode);
      if (user) {
        if (accessToken) localStorage.setItem("kaalay_token", accessToken);
        if (refreshToken) localStorage.setItem("kaalay_refresh_token", refreshToken);
        localStorage.setItem("kaalay_user", JSON.stringify(user));
        router.replace(homeRouteForRole(user.role));
      } else {
        // New user - go to registration
        setStep("register");
      }
    } catch {
      setError("Invalid OTP. Try again.");
    }
  };

  const handleRegisterSubmit = async () => {
    if (!fullName.trim()) {
      setError("Tell us your name");
      return;
    }
    if (accountType === "driver" && (!vehicleModel.trim() || !vehicleColor.trim() || !licensePlate.trim())) {
      setError("Fill in your vehicle details to register as a driver");
      return;
    }
    setError(null);
    try {
      await register({
        phoneNumber: phoneNumber.trim(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        role: accountType,
        ...(accountType === "driver"
          ? {
              vehicleModel: vehicleModel.trim(),
              vehicleColor: vehicleColor.trim(),
              vehicleCategory,
              licensePlate: licensePlate.trim().toUpperCase(),
            }
          : {}),
      });
      router.replace(homeRouteForRole(accountType));
    } catch {
      setError("Couldn't create your account. Try again.");
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pb-10 pt-14">
      <button
        onClick={() => {
          if (step === "register") setStep("otp");
          else if (step === "otp") setStep("phone");
          else router.push("/welcome");
        }}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>

      <div className="mt-8 flex-1">
        <AnimatePresence mode="wait">
          {step === "otp" ? (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10">
                <Compass className="h-8 w-8 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
                Verify your number
              </h1>
              <p className="mt-2 text-base font-medium text-muted-foreground">
                We sent a 6-digit code to {phoneNumber}
              </p>

              <div className="mt-8 space-y-2">
                <Label htmlFor="otp" className="text-sm font-bold text-foreground">
                  Verification code
                </Label>
                <div className="flex items-center gap-3 rounded-2xl border-2 border-input bg-background px-4 h-14">
                  <Compass className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
                    className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0 tracking-widest"
                  />
                </div>
              </div>

              {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}

              <Button
                size="lg"
                className="mt-8 h-14 w-full rounded-2xl text-base font-bold"
                onClick={handleOtpSubmit}
                disabled={loading || otpCode.length < 6}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
              </Button>
            </motion.div>
          ) : step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10">
                <Compass className="h-8 w-8 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10">
                <UserIcon className="h-8 w-8 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">Create your account</h1>
              <p className="mt-2 text-base font-medium text-muted-foreground">Just a couple details and you&apos;re in.</p>

              <div className="mt-6 space-y-2">
                <Label className="text-sm font-bold text-foreground">I want to sign up as a</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_TYPES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setAccountType(id)}
                      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-3xl px-1 text-center text-[11px] font-bold leading-tight transition-all ${
                        accountType === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-bold text-foreground">
                    Full name
                  </Label>
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-input bg-background px-4 h-14">
                    <UserIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <Input
                      id="fullName"
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
                      onKeyDown={(e) => e.key === "Enter" && accountType !== "driver" && handleRegisterSubmit()}
                      className="h-full border-0 p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {accountType === "driver" && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLE_CATEGORIES.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => setVehicleCategory(id)}
                          className={`flex h-16 flex-col items-center justify-center gap-1 rounded-3xl text-[10px] font-bold transition-all ${
                            vehicleCategory === id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicleModel" className="text-sm font-bold text-foreground">
                        Vehicle model
                      </Label>
                      <Input
                        id="vehicleModel"
                        placeholder="e.g. Toyota Probox"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="h-14 rounded-2xl border-2 border-input px-4 text-base font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vehicleColor" className="text-sm font-bold text-foreground">
                        Vehicle color
                      </Label>
                      <Input
                        id="vehicleColor"
                        placeholder="e.g. White"
                        value={vehicleColor}
                        onChange={(e) => setVehicleColor(e.target.value)}
                        className="h-14 rounded-2xl border-2 border-input px-4 text-base font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="licensePlate" className="text-sm font-bold text-foreground">
                        License plate
                      </Label>
                      <Input
                        id="licensePlate"
                        placeholder="e.g. KDA 123A"
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRegisterSubmit()}
                        className="h-14 rounded-2xl border-2 border-input px-4 text-base font-semibold"
                      />
                    </div>
                  </>
                )}
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
