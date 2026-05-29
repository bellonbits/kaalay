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
        // Must check for google.maps.Map specifically — google.maps can exist
        // as a partial stub before the full API is ready, causing
        // "google.maps.Map is not a constructor" in GoogleMap.componentDidMount
        if (
          typeof window.google !== 'undefined' &&
          typeof window.google.maps !== 'undefined' &&
          typeof window.google.maps.Map === 'function'
        ) {
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
