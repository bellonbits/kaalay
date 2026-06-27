'use client';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { onReconnect } from '../lib/socket';
import { useGeolocation } from '../hooks/useGeolocation';
import { createSession, updateSessionStatus } from '../lib/api';
import { useLocation } from './LocationContext';

interface ShareContextType {
  activeSession: any | null;
  startSharing: (params: any) => Promise<void>;
  stopSharing: () => Promise<void>;
  isLive: boolean;
  manualPosition: { lat: number; lng: number } | null;
  setManualPosition: (pos: { lat: number; lng: number } | null) => void;
}

const ShareContext = createContext<ShareContextType | undefined>(undefined);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const { preferredPosition: manualPosition, setPreferredPosition: setManualPosition } = useLocation();
  const { position } = useGeolocation(true);
  const socketRef = useSocket();
  const broadRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const p = manualPosition || position;
    if (!activeSession || !p || !socketRef.current) return;

    // Re-join the share room on every (re)connect so viewers keep receiving
    // updates after the broadcaster's socket drops (backgrounding, network
    // switch). Without this a single blip silently ends the live share.
    const offReconnect = onReconnect(() => {
      socketRef.current?.emit('join', activeSession.shareCode);
    });

    broadRef.current = setInterval(() => {
      const currentP = manualPosition || position;
      if (!currentP) return;

      socketRef.current?.emit('push-location', {
        code: activeSession.shareCode,
        lat: currentP.lat,
        lng: currentP.lng,
        accuracy: manualPosition ? 0 : position?.accuracy,
        heading: position?.heading,
        timestamp: Date.now(),
      });
    }, 2000);

    return () => {
      if (broadRef.current) clearInterval(broadRef.current);
      offReconnect();
    };
  }, [activeSession, position, manualPosition]);

  const startSharing = async (params: any) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null)
    );
    const s = await createSession(cleanParams);
    setActiveSession(s);

    // Broadcast to dispatch room for drivers (Uber/Bolt flow)
    if (socketRef.current) {
      const user = JSON.parse(localStorage.getItem('kaalay_user') ?? '{}');
      socketRef.current.emit('broadcast-request', {
        shareCode: s.shareCode,
        lat: params.lat,
        lng: params.lng,
        type: params.requestType || 'sharing',
        message: params.message,
        fullName: user.fullName || 'Someone'
      });
    }
  };

  const stopSharing = async () => {
    if (activeSession) {
      await updateSessionStatus(activeSession.shareCode, { status: 'ended' }).catch(() => null);
      setActiveSession(null);
    }
    if (broadRef.current) clearInterval(broadRef.current);
  };

  return (
    <ShareContext.Provider value={{ 
      activeSession, startSharing, stopSharing, isLive: !!activeSession,
      manualPosition, setManualPosition
    }}>
      {children}
    </ShareContext.Provider>
  );
}

export const useShare = () => {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShare must be used within ShareProvider');
  return ctx;
};
