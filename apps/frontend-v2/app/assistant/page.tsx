"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Send, Mic, Navigation as NavIcon, MapPin } from "lucide-react";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useLocationStore } from "@/features/location/store";
import { useNavigationStore } from "@/features/navigation/store";
import { useVoiceSearch } from "@/features/navigation/useVoiceSearch";
import { sendNavigateChatMessage } from "@/lib/api";
import type { AiChatMessage, AiResolvedDestination } from "@/types/api";

export default function NavigationAssistantPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const position = useLocationStore((s) => s.displayPosition);
  const setDestination = useNavigationStore((s) => s.setDestination);
  const setAutoStart = useNavigationStore((s) => s.setAutoStart);

  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: "assistant", text: "Where do you want to go? I can find places Google Maps can't — compounds, markets, hidden spots." },
  ]);
  const [input, setInput] = useState("");
  const [resolvedDestination, setResolvedDestination] = useState<AiResolvedDestination | null>(null);
  const [sending, setSending] = useState(false);
  const { supported: voiceSupported, listening, start: startListening } = useVoiceSearch(setInput);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, resolvedDestination]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !position || sending) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const res = await sendNavigateChatMessage({ message: text, history, lat: position.lat, lng: position.lng });
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
      if (res.resolvedDestination) setResolvedDestination(res.resolvedDestination);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't reach the assistant. Try again?" }]);
    } finally {
      setSending(false);
    }
  };

  const handleNavigate = () => {
    if (!resolvedDestination) return;
    setDestination({
      lat: resolvedDestination.lat,
      lng: resolvedDestination.lng,
      label: resolvedDestination.name,
      words: resolvedDestination.words ?? undefined,
      placeId: resolvedDestination.source === "kaalay" ? resolvedDestination.id ?? undefined : undefined,
    });
    setAutoStart(false);
    router.push("/navigate/route");
  };

  if (!ready) return null;

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
        <p className="text-base font-extrabold text-foreground">Ask Kaalay</p>
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

          {resolvedDestination && (
            <div className="ml-10 rounded-2xl bg-card p-4 shadow-lg ring-1 ring-foreground/10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-foreground">{resolvedDestination.name}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {resolvedDestination.source === "kaalay" ? "Community-mapped" : "Mapped via Google"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleNavigate}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground active:scale-95 transition-transform"
              >
                <NavIcon className="h-4 w-4" /> Navigate
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="e.g. Amina's Shop near the market…"
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
