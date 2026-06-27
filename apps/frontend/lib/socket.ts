import { io, type Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "https://app.suqafuran.com";

let socket: Socket | null = null;

/**
 * Singleton socket.io client on the `/loc` namespace, tuned for flaky
 * mobile networks: WebSocket-first with polling fallback, infinite
 * reconnection with capped exponential backoff. Ported from the working
 * previous-frontend client — this configuration was deliberate, not a
 * default.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(`${WS_URL}/loc`, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
  return socket;
}

/**
 * Registers a callback that fires on every connect (including the first
 * one and every reconnect). The server forgets room membership on
 * disconnect, so screens must re-emit their `join`/`join-group` calls
 * every time this fires, not just once on mount.
 */
export function onReconnect(rejoin: () => void): () => void {
  const s = getSocket();
  if (s.connected) rejoin();
  s.on("connect", rejoin);
  return () => {
    s.off("connect", rejoin);
  };
}
