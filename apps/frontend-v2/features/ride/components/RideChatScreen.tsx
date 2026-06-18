"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { useRideSocket } from "../useRideSocket";
import { getRideMessages, sendRideMessage } from "@/lib/api";
import type { RideChatMessage } from "@/types/api";

interface Props {
  rideId: string;
  currentUserId: string;
  peerLabel: string;
  backHref: string;
}

/** Shared by both /ride/[id]/chat (rider) and /driver/ride/[id]/chat (driver) —
 * the two sides differ only in who "currentUserId" is and where Back goes. */
export default function RideChatScreen({ rideId, currentUserId, peerLabel, backHref }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<RideChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { chatMessage } = useRideSocket(rideId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRideMessages(rideId).then(setMessages).catch(() => {});
  }, [rideId]);

  useEffect(() => {
    if (!chatMessage) return;
    setMessages((prev) => (prev.some((m) => m.id === chatMessage.id) ? prev : [...prev, chatMessage]));
  }, [chatMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      const message = await sendRideMessage(rideId, text);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch {
      toast.error("Couldn't send — try again");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3">
        <button
          onClick={() => router.push(backHref)}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <p className="truncate text-base font-extrabold text-foreground">{peerLabel}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex flex-col gap-2">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm font-medium text-muted-foreground">
              Say hello — this thread is only visible to you two.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message…"
          className="h-12 flex-1 rounded-2xl bg-secondary px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
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
