"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Send, Mic, Check } from "lucide-react";
import { toast } from "sonner";
import VehicleIllustration from "@/components/shared/VehicleIllustration";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useVoiceSearch } from "@/features/navigation/useVoiceSearch";
import { RIDE_CATEGORY_INFO } from "@/features/ride/rideCategories";
import { sendAiChatMessage, createRide, convertToWords } from "@/lib/api";
import type { AiChatMessage, AiSuggestedRide } from "@/types/api";

const FEATURES = ["Single person ride", "Verified drivers", "Fast pickup"];

export default function AiBookingPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: "assistant", text: "Hi! Tell me where you'd like to go and I'll find you a ride." },
  ]);
  const [input, setInput] = useState("");
  const [suggestedRide, setSuggestedRide] = useState<AiSuggestedRide | null>(null);
  const [sending, setSending] = useState(false);
  const [booking, setBooking] = useState(false);
  const { supported: voiceSupported, listening, start: startListening } = useVoiceSearch(setInput);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, suggestedRide]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !position || sending) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res = await sendAiChatMessage({ message: text, history, lat: position.lat, lng: position.lng });
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
      if (res.suggestedRide) setSuggestedRide(res.suggestedRide);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't reach the booking service. Try again?" }]);
    } finally {
      setSending(false);
    }
  };

  const handleBookNow = async () => {
    if (!suggestedRide || !position) return;
    setBooking(true);
    try {
      const [pickupWords, destWords] = await Promise.all([
        convertToWords(position.lat, position.lng).then((r) => r.words).catch(() => ""),
        convertToWords(suggestedRide.destination.lat, suggestedRide.destination.lng).then((r) => r.words).catch(() => ""),
      ]);
      const ride = await createRide({
        pickup: { lat: position.lat, lng: position.lng, words: pickupWords },
        destination: { lat: suggestedRide.destination.lat, lng: suggestedRide.destination.lng, words: destWords },
        category: suggestedRide.category,
        distance: 0,
        duration: suggestedRide.etaMinutes,
      });
      router.push(`/ride/${ride.id}`);
    } catch {
      toast.error("Couldn't book that ride — try again");
    } finally {
      setBooking(false);
    }
  };

  if (!ready) return null;

  const categoryInfo = suggestedRide ? RIDE_CATEGORY_INFO[suggestedRide.category] : null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <p className="text-base font-extrabold text-foreground">Book With AI Help</p>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  m.role === "user" ? "bg-secondary" : "bg-primary/15"
                }`}
              >
                {m.role === "user" ? (
                  <span className="text-xs font-bold text-foreground">You</span>
                ) : (
                  <Bot className="h-4 w-4 text-primary" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm font-medium ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-end gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground">Thinking…</div>
            </div>
          )}

          {suggestedRide && categoryInfo && (
            <div className="ml-10 rounded-2xl bg-card p-4 shadow-lg ring-1 ring-foreground/10">
              <div className="flex items-center gap-3">
                <VehicleIllustration category={suggestedRide.category} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-foreground">{categoryInfo.label}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">{categoryInfo.description}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                    in {suggestedRide.etaMinutes} min · {suggestedRide.destination.label}
                  </p>
                </div>
                <p className="flex-shrink-0 text-sm font-extrabold text-foreground">
                  {suggestedRide.currency} {Math.round(suggestedRide.fare)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {suggestedRide && (
        <div className="border-t border-border px-5 pt-3">
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span key={f} className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                <Check className="h-3 w-3" /> {f}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total cost</p>
              <p className="text-lg font-extrabold text-foreground">
                {suggestedRide.currency} {Math.round(suggestedRide.fare)}
              </p>
            </div>
            <button
              onClick={handleBookNow}
              disabled={booking || !position}
              className="h-12 rounded-2xl bg-primary px-8 text-sm font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
            >
              {booking ? "Booking…" : "Book Now"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything to AI Agent…"
          className="h-12 flex-1 rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {voiceSupported && (
          <button
            onClick={startListening}
            aria-label="Dictate"
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-secondary active:scale-95 transition-transform ${listening ? "animate-pulse" : ""}`}
          >
            <Mic className={`h-5 w-5 ${listening ? "text-emergency" : "text-muted-foreground"}`} />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
