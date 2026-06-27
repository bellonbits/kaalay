import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'https://app.suqafuran.com';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${WS_URL}/loc`, {
      // Allow polling fallback so flaky mobile networks can still connect,
      // then upgrade to websocket.
      transports: ['websocket', 'polling'],
      autoConnect: true,
      // Resilient reconnection for mobile: keep retrying with backoff forever.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socket;
}

/**
 * Run `rejoin` every time the socket (re)connects, including immediately if it
 * is already connected. Returns an unsubscribe function.
 *
 * Mobile clients drop the socket constantly (backgrounding, network switches);
 * without re-emitting the join the server forgets which room they were in and
 * live updates silently stop. Pages pass whatever join emit they need.
 */
export function onReconnect(rejoin: () => void): () => void {
  const s = getSocket();
  s.on('connect', rejoin);
  if (s.connected) rejoin();
  return () => { s.off('connect', rejoin); };
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
