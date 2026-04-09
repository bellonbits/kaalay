import React from 'react';
import GoogleMapReact from 'google-map-react';

interface LatLng { lat: number; lng: number; label?: string }

interface Props {
  center: { lat: number; lng: number };
  zoom: number;
  pickup?: LatLng;
  destination?: LatLng;
  driverLocation?: LatLng;
  showRoute?: boolean;
  eta?: string;
}

/** Green glowing destination dot — matches design */
const GlowPin: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -50%)', position: 'relative', width: '52px', height: '52px' }}>
    {/* Outer glow rings */}
    <div style={{ position: 'absolute', inset: '-12px', borderRadius: '50%', background: 'rgba(168,216,63,0.12)' }} />
    <div style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', background: 'rgba(168,216,63,0.22)' }} />
    {/* White ring */}
    <div style={{ position: 'absolute', inset: '0', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      {/* Inner black dot */}
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#1A1A2E' }} />
    </div>
  </div>
);

/** Solid black origin/pickup dot */
const OriginDot: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -50%)', width: '18px', height: '18px', borderRadius: '50%', background: '#1A1A2E', border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }} />
);

/** Top-down car marker */
const CarMarker: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))' }}>
    <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
      {/* Car body top-down */}
      <rect x="4" y="10" width="32" height="34" rx="8" fill="#8E8E9E"/>
      {/* Windshield front */}
      <rect x="8" y="12" width="24" height="10" rx="4" fill="#C0D8E8" opacity="0.7"/>
      {/* Windshield rear */}
      <rect x="8" y="30" width="24" height="10" rx="4" fill="#C0D8E8" opacity="0.5"/>
      {/* Left wheels */}
      <rect x="0" y="14" width="6" height="10" rx="3" fill="#3A3A4A"/>
      <rect x="0" y="28" width="6" height="10" rx="3" fill="#3A3A4A"/>
      {/* Right wheels */}
      <rect x="34" y="14" width="6" height="10" rx="3" fill="#3A3A4A"/>
      <rect x="34" y="28" width="6" height="10" rx="3" fill="#3A3A4A"/>
      {/* Center line */}
      <rect x="19" y="22" width="2" height="10" rx="1" fill="rgba(255,255,255,0.3)"/>
    </svg>
  </div>
);

/** "12 min" ETA green bubble */
const EtaBubble: React.FC<{ lat: number; lng: number; label: string }> = ({ label }) => (
  <div style={{ transform: 'translate(-50%, -100%)', background: '#A8D83F', borderRadius: '20px', padding: '6px 14px', whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(168,216,63,0.4)', marginBottom: '4px' }}>
    <span style={{ fontSize: '13px', fontWeight: '800', color: '#1A1A2E' }}>{label}</span>
  </div>
);

const MapView: React.FC<Props> = ({ center, zoom, pickup, destination, driverLocation, showRoute, eta }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleApiLoaded = ({ map, maps }: { map: any; maps: any }) => {
    if (!showRoute || !pickup || !destination) return;

    const directionsService = new maps.DirectionsService();
    const directionsRenderer = new maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#A8D83F',
        strokeWeight: 5,
        strokeOpacity: 1,
      },
    });
    directionsRenderer.setMap(map);

    directionsService.route({
      origin: { lat: pickup.lat, lng: pickup.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: maps.TravelMode.DRIVING,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, (result: any, status: any) => {
      if (status === maps.DirectionsStatus.OK && result) {
        directionsRenderer.setDirections(result);
      }
    });
  };

  // ETA bubble position — midpoint between pickup and destination
  const etaLat = pickup && destination ? (pickup.lat + destination.lat) / 2 : center.lat;
  const etaLng = pickup && destination ? (pickup.lng + destination.lng) / 2 : center.lng;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: apiKey }}
        center={center}
        zoom={zoom}
        options={{ styles: mapStyle, disableDefaultUI: true, gestureHandling: 'greedy' }}
        yesIWantToUseGoogleMapApiInternals
        onGoogleApiLoaded={handleApiLoaded}
      >
        {pickup && <OriginDot lat={pickup.lat} lng={pickup.lng} />}
        {destination && <GlowPin lat={destination.lat} lng={destination.lng} />}
        {driverLocation && <CarMarker lat={driverLocation.lat} lng={driverLocation.lng} />}
        {showRoute && pickup && destination && (
          <EtaBubble lat={etaLat} lng={etaLng} label={eta ?? '12 min'} />
        )}
      </GoogleMapReact>
    </div>
  );
};

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cce8d4' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dff0e0' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#5BB5CE' }] },
];

export default MapView;
