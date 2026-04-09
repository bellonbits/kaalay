import React from 'react';
import GoogleMapReact from 'google-map-react';
import { MapPin } from 'lucide-react';

interface MarkerProps {
  lat: number;
  lng: number;
  type: 'pickup' | 'destination' | 'driver';
}

const Marker: React.FC<MarkerProps> = ({ type }) => (
  <div style={{ transform: 'translate(-50%, -100%)' }}>
    <MapPin 
      size={24} 
      color={type === 'pickup' ? '#f7b731' : type === 'destination' ? '#eb3b5a' : '#20bf6b'} 
      fill={type === 'driver' ? '#20bf6b' : 'none'}
    />
  </div>
);

interface MapProps {
  center: { lat: number; lng: number };
  zoom: number;
  pickup?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  drivers?: { id: string; lat: number; lng: number }[];
}

const Map: React.FC<MapProps> = ({ center, zoom, pickup, destination, drivers }) => {
  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: '' }} // Key will be provided by user or environment
        defaultCenter={center}
        defaultZoom={zoom}
        center={center}
        options={{
          styles: darkMapStyle, // Premium dark theme for maps
        }}
      >
        {pickup && <Marker lat={pickup.lat} lng={pickup.lng} type="pickup" />}
        {destination && <Marker lat={destination.lat} lng={destination.lng} type="destination" />}
        {drivers?.map((driver) => (
          <Marker key={driver.id} lat={driver.lat} lng={driver.lng} type="driver" />
        ))}
      </GoogleMapReact>
    </div>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  // ... (Full dark theme styles would go here for brevity, keeping it simple for now)
];

export default Map;
