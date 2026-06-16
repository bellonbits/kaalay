"use client";
import React, { createContext, useContext, type ReactNode, useState, useEffect } from "react";

interface GoogleMapsContextType {
  isLoaded: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined);

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Must check for google.maps.Map AND the `marker` library specifically.
    // The script tag loads multiple libraries (`places,geometry,marker`)
    // asynchronously and independently — `google.maps.Map` can become
    // available before `google.maps.marker.AdvancedMarkerElement` does,
    // which throws "Cannot read properties of undefined (reading
    // 'AdvancedMarkerElement')" if MapBase renders in that gap. Checking
    // both, not just `Map`, was a real bug caught under rapid interaction.
    const checkLoaded = () => {
      if (
        typeof window.google?.maps?.Map === "function" &&
        typeof window.google?.maps?.marker?.AdvancedMarkerElement === "function"
      ) {
        setIsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkLoaded()) return;
    const interval = setInterval(() => {
      if (checkLoaded()) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const value = React.useMemo(() => ({ isLoaded }), [isLoaded]);

  return <GoogleMapsContext.Provider value={value}>{children}</GoogleMapsContext.Provider>;
}

export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) throw new Error("useGoogleMaps must be used within a GoogleMapsProvider");
  return context;
};
