"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { getDriverWallet } from "@/lib/api";
import type { DriverWallet } from "@/types/api";

export default function DriverEarningsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<DriverWallet | null>(null);

  useEffect(() => {
    getDriverWallet().then(setWallet).catch(() => {});
  }, []);

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <button
        onClick={() => router.back()}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>

      <h1 className="mt-4 text-2xl font-extrabold text-foreground">Earnings</h1>

      {wallet ? (
        <>
          <div className="mt-6 rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">Wallet balance</p>
            <p className="mt-1 text-3xl font-extrabold">
              {wallet.currency} {wallet.walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Gross earnings</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">
                {wallet.currency} {wallet.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Commission paid</p>
              <p className="mt-1 text-xl font-extrabold text-foreground">
                {wallet.currency} {wallet.commissionPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm font-medium text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
