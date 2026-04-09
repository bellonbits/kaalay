'use client';
import { GoogleMap, useJsApiLoader, Circle, Polyline } from '@react-google-maps/api';
import { useRef, useCallback, useEffect } from 'react';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

// Crisp, minimal light map — matches design reference
const LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',            stylers: [{ color: '#f0eeeb' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#7a7a7a' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#f0eeeb' }] },
  { featureType: 'road',                elementType: 'geometry',           stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                elementType: 'geometry.stroke',    stylers: [{ color: '#e0dedd' }] },
  { featureType: 'road.arterial',       elementType: 'labels.text.fill',   stylers: [{ color: '#888' }] },
  { featureType: 'road.highway',        elementType: 'geometry',           stylers: [{ color: '#e8e5e0' }] },
  { featureType: 'road.highway',        elementType: 'geometry.stroke',    stylers: [{ color: '#d8d4ce' }] },
  { featureType: 'water',               elementType: 'geometry',           stylers: [{ color: '#cce4f0' }] },
  { featureType: 'poi.park',            elementType: 'geometry',           stylers: [{ color: '#deefd4' }] },
  { featureType: 'landscape.natural',   elementType: 'geometry',           stylers: [{ color: '#e8e4de' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',      elementType: 'labels.text.fill',   stylers: [{ color: '#aaaaaa' }] },
];

export interface MarkerData {
  lat: number; lng: number;
  type: 'me' | 'tracked' | 'request' | 'car';
  label?: string;
  accuracy?: number;
  heading?: number;
}

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  routeTo?: { lat: number; lng: number };
  className?: string;
}

// Navigation arrow for "me"
const ME_PATH = 'M 0,-11 L 7,7 L 0,2 L -7,7 Z';
// Top-down car silhouette for other cars / helpers
const CAR_PATH = 'M -5,-10 Q -5,-13 0,-13 Q 5,-13 5,-10 L 6,4 Q 6,7 3,7 L -3,7 Q -6,7 -6,4 Z M -7,-2 L -9,3 L -7,3 Z M 7,-2 L 9,3 L 7,3 Z';

export default function MapBase({ center, zoom = 15, markers = [], routeTo, className }: Props) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: ['geometry'] });
  const mapRef    = useRef<google.maps.Map | null>(null);
  const markerArr = useRef<google.maps.Marker[]>([]);
  const routeRdr  = useRef<google.maps.DirectionsRenderer | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => { mapRef.current = m; }, []);

  // Render markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    markerArr.current.forEach(m => m.setMap(null));
    markerArr.current = [];

    markers.forEach(m => {
      let icon: google.maps.Symbol | google.maps.Icon;

      if (m.type === 'me') {
        icon = {
          path: ME_PATH,
          fillColor: '#1A1A1A',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 1.3,
          rotation: m.heading ?? 0,
          anchor: new google.maps.Point(0, 0),
        } as google.maps.Symbol;
      } else if (m.type === 'tracked') {
        icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#1A1A1A',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        } as google.maps.Symbol;
      } else if (m.type === 'car') {
        icon = {
          path: CAR_PATH,
          fillColor: '#888888',
          fillOpacity: 0.9,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
          scale: 1.4,
          rotation: m.heading ?? 0,
        } as google.maps.Symbol;
      } else {
        // request: yellow dot
        icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#FFD600',
          fillOpacity: 1,
          strokeColor: '#1A1A1A',
          strokeWeight: 2,
        } as google.maps.Symbol;
      }

      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current!,
        icon,
        title: m.label,
        zIndex: m.type === 'me' ? 10 : 5,
      });
      markerArr.current.push(marker);
    });
  }, [markers, isLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !routeTo) return;
    const origin = markers.find(m => m.type === 'me');
    if (!origin) return;
    if (!routeRdr.current) {
      routeRdr.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#1A1A1A',
          strokeWeight: 3,
          strokeOpacity: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
            offset: '0',
            repeat: '10px',
          }],
        },
      });
      routeRdr.current.setMap(mapRef.current);
    }
    new google.maps.DirectionsService().route({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: routeTo,
      travelMode: google.maps.TravelMode.DRIVING,
    }, (r, s) => {
      if (s === 'OK' && r) routeRdr.current!.setDirections(r);
    });
  }, [routeTo, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded) return (
    <div className={`bg-[#f0eeeb] flex items-center justify-center ${className ?? 'w-full h-full'}`}>
      <div className="w-7 h-7 border-2 border-[#1A1A1A] border-t-transparent rounded-full spin" />
    </div>
  );

  const me = markers.find(m => m.type === 'me');

  return (
    <GoogleMap
      mapContainerClassName={className ?? 'w-full h-full'}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      options={{ styles: LIGHT_STYLE, disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false }}
    >
      {me?.accuracy && (
        <Circle
          center={{ lat: me.lat, lng: me.lng }}
          radius={me.accuracy}
          options={{ fillColor: '#1A1A1A', fillOpacity: 0.04, strokeColor: '#1A1A1A', strokeOpacity: 0.15, strokeWeight: 1 }}
        />
      )}
    </GoogleMap>
  );
}
