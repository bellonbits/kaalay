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

/** Green destination pin */
const GlowPin: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -100%)', position: 'relative' }}>
    {/* Glow ring */}
    <div style={{ position: 'absolute', inset: '-8px', borderRadius: '50%', background: 'rgba(168,216,63,0.18)', top: 'auto', bottom: '4px', left: '-8px', right: '-8px', height: '20px' }} />
    <img src="/selected-marker.png" alt="" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 3px 6px rgba(168,216,63,0.5))' }} />
  </div>
);

/** Origin/pickup pin */
const OriginDot: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -100%)' }}>
    <img src="/marker.png" alt="" style={{ width: '30px', height: '30px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
  </div>
);

/** Driver car marker */
const CarMarker: React.FC<{ lat: number; lng: number }> = () => (
  <div style={{ transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))' }}>
    <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
      <rect x="4" y="10" width="32" height="34" rx="8" fill="#8E8E9E"/>
      <rect x="8" y="12" width="24" height="10" rx="4" fill="#C0D8E8" opacity="0.7"/>
      <rect x="8" y="30" width="24" height="10" rx="4" fill="#C0D8E8" opacity="0.5"/>
      <rect x="0" y="14" width="6" height="10" rx="3" fill="#3A3A4A"/>
      <rect x="0" y="28" width="6" height="10" rx="3" fill="#3A3A4A"/>
      <rect x="34" y="14" width="6" height="10" rx="3" fill="#3A3A4A"/>
      <rect x="34" y="28" width="6" height="10" rx="3" fill="#3A3A4A"/>
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
