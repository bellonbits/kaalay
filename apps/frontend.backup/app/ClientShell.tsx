'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { LocationProvider } from '../context/LocationContext';
import { ShareProvider } from '../context/ShareContext';
import { GoogleMapsProvider } from '../components/GoogleMapsProvider';

export default function ClientShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return null;

  return (
    <AuthProvider>
      <LocationProvider>
        <GoogleMapsProvider>
          <ShareProvider>
            {children}
          </ShareProvider>
        </GoogleMapsProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
