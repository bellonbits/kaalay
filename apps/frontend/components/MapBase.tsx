'use client';
import { GoogleMap, useJsApiLoader, Circle } from '@react-google-maps/api';
import { useRef, useCallback, useEffect } from 'react';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d3a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212135' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#A8D83F' }] },
];

export interface MarkerData {
  lat: number;
  lng: number;
  type: 'me' | 'tracked' | 'request' | 'helper';
  label?: string;
  accuracy?: number;
}

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  routeTo?: { lat: number; lng: number };
  className?: string;
}

export default function MapBase({ center, zoom = 15, markers = [], routeTo, className }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY,
    libraries: ['geometry'],
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routeRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Draw custom markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    markers.forEach(m => {
      const color = m.type === 'me' ? '#A8D83F'
        : m.type === 'tracked' ? '#FF6B6B'
        : m.type === 'helper' ? '#7B61FF'
        : '#FFD93D';

      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: m.type === 'me' ? 10 : 12,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#0F0F0F',
          strokeWeight: 3,
        },
        title: m.label,
        zIndex: m.type === 'me' ? 10 : 5,
      });
      markersRef.current.push(marker);
    });
  }, [markers, isLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !routeTo) return;
    const origin = markers.find(m => m.type === 'me');
    if (!origin) return;

    const ds = new google.maps.DirectionsService();
    if (!routeRef.current) {
      routeRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#A8D83F', strokeWeight: 4, strokeOpacity: 0.9 },
      });
      routeRef.current.setMap(mapRef.current);
    }
    ds.route({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: routeTo,
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) routeRef.current!.setDirections(result);
    });
  }, [routeTo, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded) return (
    <div className={`bg-[#1a1a2e] flex items-center justify-center ${className ?? 'w-full h-full'}`}>
      <div className="w-8 h-8 border-2 border-[#A8D83F] border-t-transparent rounded-full spin" />
    </div>
  );

  // Accuracy circle for my position
  const me = markers.find(m => m.type === 'me');

  return (
    <GoogleMap
      mapContainerClassName={className ?? 'w-full h-full'}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      options={{
        styles: DARK_STYLE,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      }}
    >
      {me?.accuracy && (
        <Circle
          center={{ lat: me.lat, lng: me.lng }}
          radius={me.accuracy}
          options={{
            fillColor: '#A8D83F',
            fillOpacity: 0.06,
            strokeColor: '#A8D83F',
            strokeOpacity: 0.3,
            strokeWeight: 1,
          }}
        />
      )}
    </GoogleMap>
  );
}
