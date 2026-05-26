'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface LocationContextType {
  preferredPosition: Position | null;
  setPreferredPosition: (pos: Position | null) => void;
  resetToGPS: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [preferredPosition, setPreferredPositionState] = useState<Position | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kaalay_preferred_pos');
    if (saved) {
      try {
        setPreferredPositionState(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved position', e);
      }
    }
  }, []);

  const setPreferredPosition = React.useCallback((pos: Position | null) => {
    setPreferredPositionState(pos);
    if (pos) {
      localStorage.setItem('kaalay_preferred_pos', JSON.stringify(pos));
    } else {
      localStorage.removeItem('kaalay_preferred_pos');
    }
  }, []);

  const resetToGPS = React.useCallback(() => setPreferredPosition(null), [setPreferredPosition]);

  const value = React.useMemo(() => ({ 
    preferredPosition, 
    setPreferredPosition, 
    resetToGPS 
  }), [preferredPosition, setPreferredPosition, resetToGPS]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
