'use client';
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    return () => {
      // Don't disconnect on unmount — shared singleton
    };
  }, []);

  return socketRef;
}

export function useSessionSocket(
  code: string | null,
  onLocation: (data: { lat: number; lng: number; accuracy?: number; heading?: number; timestamp: number }) => void,
  onStatus?: (data: { status: string }) => void,
  onAccepted?: (data: { helperName: string }) => void,
) {
  const socketRef = useSocket();

  useEffect(() => {
    if (!code) return;
    const s = socketRef.current;
    if (!s) return;

    s.emit('join', code);
    s.on('location', onLocation);
    if (onStatus) s.on('status', onStatus);
    if (onAccepted) s.on('request-accepted', onAccepted);

    return () => {
      s.emit('leave', code);
      s.off('location', onLocation);
      if (onStatus) s.off('status', onStatus);
      if (onAccepted) s.off('request-accepted', onAccepted);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
}
