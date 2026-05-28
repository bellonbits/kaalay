'use client';
/**
 * components/AdvancedMarker.tsx
 * Replaces the deprecated google.maps.Marker / MarkerF.
 * Uses google.maps.marker.AdvancedMarkerElement which requires:
 *   1. The Maps JS API loaded with `libraries=...,marker`
 *   2. The GoogleMap instance created with a valid `mapId`
 *      (create one in Cloud Console → Maps → Map Styles → Create Map ID)
 *      Set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID in your .env
 *
 * NOTE: When mapId is used, the `styles` array on GoogleMap options is ignored.
 * Use Cloud-based map styling instead:
 * https://developers.google.com/maps/documentation/javascript/cloud-based-map-styling
 */
import { useEffect, useRef } from 'react';

interface Props {
  /** The Google Map instance this marker belongs to. */
  map: google.maps.Map | null;
  position: google.maps.LatLngLiteral;
  /** Pre-built HTMLElement from PinIcon — rendered as the marker's visual. */
  content: HTMLElement;
  zIndex?: number;
  title?: string;
  onClick?: () => void;
}

export default function AdvancedMarker({
  map,
  position,
  content,
  zIndex,
  title,
  onClick,
}: Props) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  // Mount / unmount
  useEffect(() => {
    if (!map) return;

    // AdvancedMarkerElement requires the `marker` library to be loaded
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.warn(
        '[AdvancedMarker] AdvancedMarkerElement not available. ' +
        'Add "marker" to the libraries list in your Maps script URL.',
      );
      return;
    }

    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content,
      title,
      zIndex,
    });

    if (onClick) {
      clickListenerRef.current = markerRef.current.addListener('click', onClick);
    }

    return () => {
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update position without remounting the marker
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng]);

  // Update zIndex without remounting
  useEffect(() => {
    if (markerRef.current && zIndex !== undefined) {
      markerRef.current.zIndex = zIndex;
    }
  }, [zIndex]);

  return null; // renders nothing in the React tree
}
