import { useState, useEffect } from 'react';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const useGPS = () => {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const getCurrentPosition = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'denied' || permissions.location === 'prompt') {
          await Geolocation.requestPermissions();
        }
        const coordinates = await Geolocation.getCurrentPosition();
        setPosition(coordinates);
      } else {
        // Web fallback
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPosition({
              timestamp: pos.timestamp,
              coords: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                magneticHeading: undefined,
                trueHeading: undefined,
                headingAccuracy: undefined,
                course: undefined,
                courseAccuracy: undefined,
              } as Position['coords'],
            });
          },
          (err) => setError(err.message),
          { enableHighAccuracy: true }
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown location error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentPosition();
  }, []);

  return { position, error, loading, refresh: getCurrentPosition };
};
