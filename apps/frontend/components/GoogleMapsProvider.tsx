'use client';
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined);

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if google is already loaded globally via layout script tag
    if (typeof window !== 'undefined') {
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
          return true;
        }
        return false;
      };

      if (!checkLoaded()) {
        const interval = setInterval(() => {
          if (checkLoaded()) {
            clearInterval(interval);
          }
        }, 80);
        return () => clearInterval(interval);
      }
    }
  }, []);

  const value = React.useMemo(() => ({ isLoaded, loadError: undefined }), [isLoaded]);

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
};
