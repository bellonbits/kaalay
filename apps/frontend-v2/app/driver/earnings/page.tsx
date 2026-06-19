"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Landmark, TrendingUp, Calendar, Clock, DollarSign, X, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { getDriverWallet, withdrawEarnings, getWithdrawalTransactions } from "@/lib/api";
import type { DriverWallet, DriverTransaction } from "@/types/api";

type TabType = "today" | "weekly" | "monthly";

export default function DriverEarningsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<"mpesa" | "bank">("mpesa");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [bankName, setBankName] = useState("KCB Bank");
  const [accountName, setAccountName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<DriverTransaction[]>([]);

  const fetchWalletAndTx = () => {
    getDriverWallet().then(setWallet).catch(() => {});
    getWithdrawalTransactions().then(setTransactions).catch(() => {});
  };

  useEffect(() => {
    fetchWalletAndTx();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (val > wallet.walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setProcessing(true);
    try {
      const details =
        withdrawMethod === "mpesa"
          ? recipient
          : `${bankName} - A/C ${recipient} (${accountName})`;

      await withdrawEarnings(withdrawMethod, val, details);
      toast.success(`Successfully initiated withdrawal of KES ${val.toLocaleString()}`);
      setWithdrawOpen(false);
      setAmount("");
      setRecipient("");
      setAccountName("");
      fetchWalletAndTx();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Withdrawal failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] text-left">
      {/* Header bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary hover:bg-secondary/80 active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-2xl font-extrabold text-foreground">Earnings & Wallet</h1>
      </div>

      {wallet ? (
        <div className="mt-6 flex flex-col gap-6">
          {/* Main Wallet Card */}
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
              <Wallet className="h-40 w-40" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest opacity-80">Wallet Balance</p>
            <p className="mt-2 text-4xl font-black">
              {wallet.currency} {wallet.walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setWithdrawOpen(true)}
                className="flex-1 h-12 rounded-xl bg-white text-primary font-black text-sm active:scale-95 transition-transform hover:bg-opacity-95 shadow-sm"
              >
                WITHDRAW FUNDS
              </button>
            </div>
          </div>

          {/* Quick Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/30">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Gross earnings</span>
              <p className="mt-1 text-lg font-black text-foreground">
                KES {wallet.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/30">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Commission Paid (20%)</span>
              <p className="mt-1 text-lg font-black text-red-500">
                KES {wallet.commissionPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-border/60">
            {(["today", "weekly", "monthly"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 pb-3 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="flex flex-col gap-4">
            {activeTab === "today" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                {/* Stats layout */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-secondary/35 p-3 text-center">
                    <DollarSign className="h-4 w-4 text-primary mx-auto mb-1" />
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Earnings</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block">KES {Math.round(wallet.walletBalance)}</span>
                  </div>
                  <div className="rounded-xl bg-secondary/35 p-3 text-center">
                    <Calendar className="h-4 w-4 text-primary mx-auto mb-1" />
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Trips</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block">3 Completed</span>
                  </div>
                  <div className="rounded-xl bg-secondary/35 p-3 text-center">
                    <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Hours online</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block">4.5 hrs</span>
                  </div>
                </div>

                {/* Ride list */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Completed Today</p>
                  {[
                    { id: "1", from: "KM4 Square", to: "Mogadishu Airport", fare: 450, time: "18:24" },
                    { id: "2", from: "Jazeera Beach", to: "Bakaara Market", fare: 520, time: "15:40" },
                    { id: "3", from: "Wadajir Road", to: "Medina Hospital", fare: 320, time: "11:15" }
                  ].map((ride) => (
                    <div key={ride.id} className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border/30 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground leading-none">{ride.time}</p>
                        <p className="text-sm font-extrabold text-foreground mt-1 truncate">{ride.from} → {ride.to}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-black text-primary">KES {ride.fare}</p>
                        <p className="text-[9px] font-bold text-muted-foreground">Net: KES {Math.round(ride.fare * 0.8)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "weekly" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                {/* CSS Bar Chart */}
                <div className="rounded-2xl bg-card p-5 border border-border/40 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase leading-none">Weekly totals</p>
                      <p className="text-lg font-black text-foreground mt-1">KES {(wallet.totalGross * 1.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-500 uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> +15.4%
                    </span>
                  </div>
                  {/* Chart representation */}
                  <div className="flex items-end justify-between h-32 gap-2 pt-4">
                    {[
                      { day: "M", val: 1200 },
                      { day: "T", val: 1600 },
                      { day: "W", val: 900 },
                      { day: "T", val: 2100 },
                      { day: "F", val: 3400 },
                      { day: "S", val: 4200 },
                      { day: "S", val: 1500 }
                    ].map((item, i) => {
                      const maxVal = 4200;
                      const percentHeight = Math.round((item.val / maxVal) * 100);
                      return (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end gap-1.5">
                          <div className="text-[8px] font-bold text-muted-foreground">KES {item.val}</div>
                          <div
                            style={{ height: `${percentHeight}%` }}
                            className="w-full bg-primary/20 hover:bg-primary rounded-t-lg transition-all duration-300"
                          />
                          <span className="text-[10px] font-black text-foreground">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-secondary/35 p-3 text-center">
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Total rides</span>
                    <span className="text-lg font-black text-foreground mt-1 block">17 Rides</span>
                  </div>
                  <div className="rounded-xl bg-secondary/35 p-3 text-center">
                    <span className="block text-[8px] font-bold text-muted-foreground uppercase leading-none">Daily Average</span>
                    <span className="text-lg font-black text-foreground mt-1 block">KES 2,120</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "monthly" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                {/* Monthly Analytics */}
                <div className="rounded-2xl bg-card p-4 border border-border/40 shadow-sm flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground">Revenue Expansion</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1 leading-snug">
                      Your monthly order volume expanded by 24% over the last 30 days due to increased estate access mapping.
                    </p>
                  </div>
                  <span className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-card p-4 border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wide leading-none">Total Distance</span>
                    <p className="text-lg font-black text-foreground mt-1">142.5 km</p>
                  </div>
                  <div className="rounded-2xl bg-card p-4 border border-border/30">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wide leading-none">Trip rating</span>
                    <p className="text-lg font-black text-[#F59E0B] mt-1">★ 4.93 avg</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transaction History Ledger List */}
          <div className="flex flex-col gap-3 mt-4">
            <h2 className="text-base font-black text-foreground">Transaction History</h2>
            {transactions.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground italic">No past withdrawals logged yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border/30 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-red-500/10 p-1 text-red-500">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm font-black text-foreground truncate">Withdrawal ({tx.method.toUpperCase()})</p>
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground mt-1">
                        To: {tx.recipient} · {new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-black text-red-500">- KES {tx.amount}</p>
                      <span className="inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black text-emerald-500 uppercase tracking-wide mt-1">
                        Success
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted-foreground animate-pulse">Loading wallet balance…</p>
      )}

      {/* Withdrawal Form Modal Overlay */}
      {withdrawOpen && wallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleWithdraw}
            className="w-full max-w-sm rounded-[32px] bg-card p-6 shadow-2xl border border-border animate-slide-up-spring flex flex-col gap-4 text-left"
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-lg font-black text-foreground">Withdraw Earnings</h3>
              <button type="button" onClick={() => setWithdrawOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Method selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select payout method</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawMethod("mpesa");
                    setRecipient("");
                  }}
                  className={`h-13 rounded-2xl font-black text-xs border flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                    withdrawMethod === "mpesa"
                      ? "bg-black text-yellow-400 border-black shadow-md"
                      : "bg-secondary text-foreground border-transparent"
                  }`}
                >
                  <DollarSign className="h-4 w-4" /> M-Pesa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawMethod("bank");
                    setRecipient("");
                  }}
                  className={`h-13 rounded-2xl font-black text-xs border flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                    withdrawMethod === "bank"
                      ? "bg-black text-yellow-400 border-black shadow-md"
                      : "bg-secondary text-foreground border-transparent"
                  }`}
                >
                  <Landmark className="h-4 w-4" /> Bank Transfer
                </button>
              </div>
            </div>

            {/* Amount input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Withdrawal Amount (KES)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max: ${Math.round(wallet.walletBalance)}`}
                  className="w-full h-13 rounded-xl bg-secondary/50 border border-border/40 px-3.5 pr-14 text-sm font-extrabold outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.floor(wallet.walletBalance)))}
                  className="absolute right-3.5 top-3.5 text-xs font-black text-primary uppercase"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Method fields */}
            {withdrawMethod === "mpesa" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">M-Pesa Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full h-13 rounded-xl bg-secondary/50 border border-border/40 px-3.5 text-sm font-extrabold outline-none focus:border-primary"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-13 rounded-xl bg-secondary/50 border border-border/40 px-3.5 text-sm font-extrabold outline-none focus:border-primary"
                  >
                    <option value="KCB Bank">Kenya Commercial Bank (KCB)</option>
                    <option value="Equity Bank">Equity Bank</option>
                    <option value="Cooperative Bank">Co-operative Bank</option>
                    <option value="Barclays Bank">Absa Bank</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Account Number</label>
                  <input
                    type="text"
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. 11029384756"
                    className="w-full h-13 rounded-xl bg-secondary/50 border border-border/40 px-3.5 text-sm font-extrabold outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Account Name</label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Peter Gatitu"
                    className="w-full h-13 rounded-xl bg-secondary/50 border border-border/40 px-3.5 text-sm font-extrabold outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={processing}
              className="h-14 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-lg shadow-primary/20 mt-2 flex items-center justify-center gap-1.5"
            >
              {processing ? "Processing…" : "CONFIRM WITHDRAWAL"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
