'use client';
import { useState, useRef } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { EnvironmentOutlined, CarOutlined, SearchOutlined, SwapOutlined, LoadingOutlined } from '@ant-design/icons';
import { convertToCoordinates } from '../lib/api';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
const LIBRARIES: ('geometry' | 'places')[] = ['geometry', 'places'];

export interface LocationPoint {
  lat: number;
  lng: number;
  label: string;
  isW3W?: boolean;
}

interface Props {
  currentLocation?: { lat: number; lng: number };
  onRouteSubmit: (start: LocationPoint, dest: LocationPoint) => void;
  onClose: () => void;
}

export default function NavigationSheet({ currentLocation, onRouteSubmit, onClose }: Props) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: LIBRARIES });
  
  const [startQuery, setStartQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  
  const [startPoint, setStartPoint] = useState<LocationPoint | null>(null);
  const [destPoint, setDestPoint] = useState<LocationPoint | null>(null);
  
  const [loadingW3W, setLoadingW3W] = useState(false);

  const startAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Use "My Location" if `currentLocation` exists and `startPoint` is null
  const effectiveStart = startPoint ?? (currentLocation ? { ...currentLocation, label: 'Your Current Location' } : null);

  const isW3W = (str: string) => /^\/{0,2}[a-z]+\.[a-z]+\.[a-z]+$/i.test(str.trim());

  const handlePlaceChanged = (
    autocompleteRef: React.MutableRefObject<google.maps.places.Autocomplete | null>,
    setPoint: (p: LocationPoint) => void,
    setQuery: (q: string) => void
  ) => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setPoint({ lat, lng, label: place.formatted_address || place.name || '' });
      setQuery(place.name || place.formatted_address || '');
    }
  };

  const checkW3W = async (query: string, setPoint: (p: LocationPoint) => void) => {
    if (isW3W(query)) {
      setLoadingW3W(true);
      try {
        const { latitude, longitude, what3words } = await convertToCoordinates(query);
        setPoint({ lat: latitude, lng: longitude, label: `///${what3words}`, isW3W: true });
      } catch (err) {
        console.error("what3words conversion failed", err);
      } finally {
        setLoadingW3W(false);
      }
    }
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartQuery(e.target.value);
    if (startPoint) setStartPoint(null);
  };
  const handleDestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDestQuery(e.target.value);
    if (destPoint) setDestPoint(null);
  };

  const handleStartBlur = () => { checkW3W(startQuery, setStartPoint); };
  const handleDestBlur = () => { checkW3W(destQuery, setDestPoint); };

  const submitRoute = () => {
    if (effectiveStart && destPoint) onRouteSubmit(effectiveStart, destPoint);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: '#F7F7F7', display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: '#FFFFFF', padding: '48px 16px 16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Plan your ride</h2>
          <button onClick={onClose} style={{
            background: '#F0F0F0', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 16
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
          {/* Timline graphic */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
            <div style={{ width: 8, height: 8, background: '#1A1A1A', borderRadius: '50%' }} />
            <div style={{ width: 2, height: 30, background: '#E0E0E0', margin: '4px 0' }} />
            <div style={{ width: 8, height: 8, background: '#FFD600', borderRadius: '0' }} />
          </div>

          {/* Inputs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              {!isLoaded ? <LoadingOutlined style={{ position: 'absolute', right: 12, top: 12 }} /> :
                <Autocomplete
                  onLoad={(auto) => { startAutocompleteRef.current = auto; }}
                  onPlaceChanged={() => handlePlaceChanged(startAutocompleteRef, setStartPoint, setStartQuery)}
                >
                  <input
                    placeholder="Current Location"
                    value={startPoint?.label ?? startQuery}
                    onChange={handleStartChange}
                    onBlur={handleStartBlur}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      background: '#F7F7F7', border: '1.5px solid transparent',
                      outline: 'none', fontSize: 15, fontWeight: 500, color: '#1A1A1A'
                    }}
                  />
                </Autocomplete>
              }
            </div>
            
            <div style={{ position: 'relative' }}>
              {!isLoaded ? <LoadingOutlined style={{ position: 'absolute', right: 12, top: 12 }} /> :
                <Autocomplete
                  onLoad={(auto) => { destAutocompleteRef.current = auto; }}
                  onPlaceChanged={() => handlePlaceChanged(destAutocompleteRef, setDestPoint, setDestQuery)}
                >
                  <input
                    autoFocus
                    placeholder="Where to? (e.g. filled.count.soap)"
                    value={destQuery}
                    onChange={handleDestChange}
                    onBlur={handleDestBlur}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      background: '#F7F7F7', border: '1.5px solid transparent',
                      outline: 'none', fontSize: 15, fontWeight: 500, color: '#1A1A1A'
                    }}
                  />
                </Autocomplete>
              }
              {loadingW3W && <LoadingOutlined style={{ position: 'absolute', right: 12, top: 12, color: '#FFD600' }} />}
            </div>
          </div>
          
          <button style={{
            position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
            background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10
          }}>
            <SwapOutlined rotate={90} style={{ color: '#888' }} />
          </button>
        </div>
      </div>

      {/* Helper text about w3w */}
      <div style={{ padding: '24px 20px', background: '#F7F7F7', flex: 1 }}>
        <p style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
          <EnvironmentOutlined /> You can type regular addresses or <b>what3words</b> directly in the box to pinpoint an exact 3m square.
        </p>
      </div>

      {/* Confirmation Button */}
      {effectiveStart && destPoint && (
        <div style={{ background: '#FFFFFF', padding: '20px', boxShadow: '0 -4px 16px rgba(0,0,0,0.05)' }}>
          <button
            onClick={submitRoute}
            style={{
              width: '100%', background: '#1A1A1A', color: '#FFF',
              padding: '16px', borderRadius: 16, fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', cursor: 'pointer'
            }}
          >
            <CarOutlined /> Show Route to Destination
          </button>
        </div>
      )}
    </div>
  );
}
