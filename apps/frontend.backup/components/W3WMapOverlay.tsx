'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ShareAltOutlined, CompassOutlined, StarOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';

interface W3WSquare {
  words: string;
  coordinates: { lat: number; lng: number };
  square: {
    southwest: { lat: number; lng: number };
    northeast: { lat: number; lng: number };
  };
  nearestPlace: string;
  country: string;
  map: string;
}

interface Props {
  map: google.maps.Map | null;        // Pass your mapRef.current
  apiKey: string;                      // Your w3w API key
  visible?: boolean;
  onSquareSelect?: (square: W3WSquare) => void;
  selectedWords?: string | null;       // Externally set selected square
}

const W3W_API = 'https://api.what3words.com/v3';

export default function W3WMapOverlay({ map, apiKey, visible = true, onSquareSelect, selectedWords }: Props) {
  const gridPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const squareHighlightRef = useRef<google.maps.Rectangle | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<W3WSquare | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── DRAW GRID LINES ─────────────────────────────────────────────────────
  const drawGrid = useCallback(async () => {
    if (!map || !visible) return;

    const zoom = map.getZoom() ?? 0;
    
    // Only show grid at zoom 17+ (same as what3words official map)
    if (zoom < 17) {
      gridPolylinesRef.current.forEach(p => p.setMap(null));
      gridPolylinesRef.current = [];
      return;
    }

    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    try {
      const res = await fetch(
        `${W3W_API}/grid-section?bounding-box=${sw.lat()},${sw.lng()},${ne.lat()},${ne.lng()}&key=${apiKey}`
      );

      if (!res.ok) return;
      const data = await res.json();
      if (!data.lines) return;

      // Clear old grid lines
      gridPolylinesRef.current.forEach(p => p.setMap(null));
      gridPolylinesRef.current = [];

      // Draw new grid lines
      data.lines.forEach((line: { start: { lat: number; lng: number }; end: { lat: number; lng: number } }) => {
        const polyline = new google.maps.Polyline({
          path: [line.start, line.end],
          map,
          strokeColor: '#E11F26',   // w3w red
          strokeOpacity: 0.3,
          strokeWeight: 0.5,
          clickable: false,
          zIndex: 1,
        });
        gridPolylinesRef.current.push(polyline);
      });
    } catch (err) {
      console.warn('[W3WGrid] fetch failed:', err);
    }
  }, [map, apiKey, visible]);

  // ── HIGHLIGHT SELECTED SQUARE ────────────────────────────────────────────
  const highlightSquare = useCallback((square: W3WSquare) => {
    if (!map) return;

    squareHighlightRef.current?.setMap(null);

    squareHighlightRef.current = new google.maps.Rectangle({
      map,
      bounds: {
        south: square.square.southwest.lat,
        west:  square.square.southwest.lng,
        north: square.square.northeast.lat,
        east:  square.square.northeast.lng,
      },
      fillColor: '#E11F26',
      fillOpacity: 0.25,
      strokeColor: '#E11F26',
      strokeOpacity: 0.9,
      strokeWeight: 1.5,
      clickable: false,
      zIndex: 3,
    });
  }, [map]);

  // ── CONVERT CLICK → W3W ─────────────────────────────────────────────────
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${W3W_API}/convert-to-3wa?coordinates=${lat},${lng}&key=${apiKey}`
      );
      if (!res.ok) return;
      const data: W3WSquare = await res.json();

      setSelectedSquare(data);
      highlightSquare(data);
      onSquareSelect?.(data);

      // Pan map to center of selected square
      const centerLat = (data.square.southwest.lat + data.square.northeast.lat) / 2;
      const centerLng = (data.square.southwest.lng + data.square.northeast.lng) / 2;
      map?.panTo({ lat: centerLat, lng: centerLng });

    } catch (err) {
      console.warn('[W3W] click conversion failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [map, apiKey, highlightSquare, onSquareSelect]);

  // ── ATTACH MAP LISTENERS ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !visible) return;

    // Draw grid on idle (after pan/zoom settles)
    idleListenerRef.current = map.addListener('idle', drawGrid);

    // Click to select square
    clickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      handleMapClick(e.latLng.lat(), e.latLng.lng());
    });

    // Initial grid draw
    drawGrid();

    return () => {
      idleListenerRef.current?.remove();
      clickListenerRef.current?.remove();
      gridPolylinesRef.current.forEach(p => p.setMap(null));
      gridPolylinesRef.current = [];
      squareHighlightRef.current?.setMap(null);
    };
  }, [map, visible, drawGrid, handleMapClick]);

  // ── EXTERNAL selectedWords prop ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedWords || !map) return;
    const fetchAndHighlight = async () => {
      try {
        const res = await fetch(
          `${W3W_API}/convert-to-coordinates?words=${selectedWords}&key=${apiKey}`
        );
        if (!res.ok) return;
        const data = await res.json();
        // convert-to-coordinates doesn't return square bounds — call convert-to-3wa
        const res2 = await fetch(
          `${W3W_API}/convert-to-3wa?coordinates=${data.coordinates.lat},${data.coordinates.lng}&key=${apiKey}`
        );
        const square: W3WSquare = await res2.json();
        setSelectedSquare(square);
        highlightSquare(square);
      } catch {}
    };
    fetchAndHighlight();
  }, [selectedWords, map, apiKey, highlightSquare]);

  // ── ACTION HANDLERS ──────────────────────────────────────────────────────
  const copyAddress = () => {
    if (!selectedSquare) return;
    navigator.clipboard.writeText(`///${selectedSquare.words}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInW3WApp = () => {
    if (!selectedSquare) return;
    window.open(`https://w3w.co/${selectedSquare.words}`, '_blank');
  };

  const shareAddress = async () => {
    if (!selectedSquare) return;
    const text = `///${selectedSquare.words}\n${window.location.origin}`;
    if (navigator.share) {
      await navigator.share({ title: `///  ${selectedSquare.words}`, text, url: `https://w3w.co/${selectedSquare.words}` });
    } else {
      copyAddress();
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (!visible || !selectedSquare) return null;

  return (
    <div className="absolute top-20 left-4 z-40 animate-slide-down pointer-events-auto">
      <div className="bg-white rounded-[20px] shadow-2xl border border-gray-100 overflow-hidden min-w-[280px] max-w-[340px]">
        
        {/* w3w address header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* w3w logo — three red slashes */}
            <span className="text-[#E11F26] font-black text-lg leading-none shrink-0">///</span>
            <h2 className="text-[22px] font-black text-[#1A1A1A] leading-tight truncate">
              {selectedSquare.words}
            </h2>
          </div>
          <button
            onClick={copyAddress}
            className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            {copied
              ? <CheckOutlined className="text-green-500 text-sm" />
              : <CopyOutlined className="text-gray-500 text-sm" />
            }
          </button>
        </div>

        {/* Nearest place */}
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400 font-medium">
            {selectedSquare.nearestPlace}{selectedSquare.country ? `, ${selectedSquare.country}` : ''}
          </p>
        </div>

        {/* Action buttons — match official w3w map */}
        <div className="px-4 pb-5 flex gap-2">
          <button
            onClick={shareAddress}
            className="flex-1 h-11 bg-[#E11F26] hover:bg-[#c91820] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <ShareAltOutlined />
            Share
          </button>
          <button
            onClick={openInW3WApp}
            className="flex-1 h-11 bg-[#1A1A1A] hover:bg-[#333] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <CompassOutlined />
            Navigate
          </button>
          <button
            onClick={() => onSquareSelect?.(selectedSquare)}
            className="flex-1 h-11 bg-[#1A1A1A] hover:bg-[#333] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <StarOutlined />
            Use
          </button>
        </div>
      </div>
    </div>
  );
}
