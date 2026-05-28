'use client';
/**
 * NavigationPanel
 * ───────────────
 * A standalone bottom-sheet panel that shows:
 *   • Road distance + ETA (from Directions API)
 *   • Next turn instruction
 *   • Straight-line distance (as-the-crow-flies)
 *   • Travel mode tabs (walk / drive / bike)
 *   • Arrival confirmation when close enough
 *
 * Usage:
 *   <NavigationPanel
 *     routeInfo={routeInfo}          // RouteInfo from MapBase's onRouteInfo callback
 *     travelMode={travelMode}
 *     onChangeTravelMode={setTravelMode}
 *     onArrived={() => ...}
 *     destinationLabel="Kaalay HQ"
 *   />
 *
 * The component renders nothing when routeInfo is null, so it's safe to
 * always mount it in a navigation screen.
 */

import { useState, useEffect } from 'react';
import type { RouteInfo } from './MapBase';

// ── helpers ───────────────────────────────────────────────────────────────────
function formatDist(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

// Strip any leftover HTML tags that Google sometimes injects into instructions
function cleanInstruction(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

// ── sub-components ────────────────────────────────────────────────────────────
type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

const MODE_TABS: { mode: TravelMode; emoji: string; label: string }[] = [
  { mode: 'DRIVING',   emoji: '🚗', label: 'Drive'  },
  { mode: 'WALKING',   emoji: '🚶', label: 'Walk'   },
  { mode: 'BICYCLING', emoji: '🚲', label: 'Bike'   },
  { mode: 'TRANSIT',   emoji: '🚌', label: 'Transit'},
];

interface ModeTabsProps {
  current: TravelMode;
  onChange: (m: TravelMode) => void;
}
function ModeTabs({ current, onChange }: ModeTabsProps) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {MODE_TABS.map(({ mode, emoji, label }) => {
        const active = current === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            style={{
              flex: 1, padding: '7px 4px',
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: active ? '#000080' : '#F3F4F6',
              color: active ? '#FFFFFF' : '#6B7280',
              fontWeight: 700, fontSize: 11,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: 18 }}>{emoji}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
interface Props {
  routeInfo: RouteInfo | null;
  travelMode: TravelMode;
  onChangeTravelMode: (m: TravelMode) => void;
  onArrived?: () => void;
  destinationLabel?: string;
  /** metres threshold to show the "I've arrived" button. Default: 50 */
  arrivalThresholdMetres?: number;
}

export default function NavigationPanel({
  routeInfo,
  travelMode,
  onChangeTravelMode,
  onArrived,
  destinationLabel,
  arrivalThresholdMetres = 50,
}: Props) {
  const [arrived, setArrived] = useState(false);

  // Reset arrived flag if destination changes (distance grows again)
  useEffect(() => {
    if (routeInfo && routeInfo.distanceMetres > arrivalThresholdMetres * 2) {
      setArrived(false);
    }
  }, [routeInfo?.distanceMetres, arrivalThresholdMetres]);

  if (!routeInfo) return null;

  const isNearby = routeInfo.distanceMetres <= arrivalThresholdMetres;
  const instruction = cleanInstruction(routeInfo.nextStep) || 'Follow the route';
  const hasDuration = routeInfo.durationText && routeInfo.durationSeconds > 0;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '24px 24px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
      padding: '20px 20px 28px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Drag handle */}
      <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 99, alignSelf: 'center', marginBottom: 18 }} />

      {/* Travel mode tabs */}
      <ModeTabs current={travelMode} onChange={onChangeTravelMode} />

      {/* ── Main stats row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>

        {/* Distance card */}
        <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Distance
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
            {routeInfo.distanceText || formatDist(routeInfo.distanceMetres)}
          </div>
          {/* Straight-line if it differs from road distance by > 10% */}
          {routeInfo.distanceMetres > 0 &&
           Math.abs(routeInfo.distanceMetres - routeInfo.straightLineMetres) / routeInfo.distanceMetres > 0.1 && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              {formatDist(routeInfo.straightLineMetres)} as-the-crow-flies
            </div>
          )}
        </div>

        {/* ETA card */}
        <div style={{ flex: 1, background: '#000080', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            ETA
          </div>
          {hasDuration ? (
            <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
              {routeInfo.durationText}
            </div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4 }}>
              No road data
            </div>
          )}
        </div>
      </div>

      {/* ── Next instruction ── */}
      <div style={{
        background: '#ECECFF',
        border: '1.5px solid #C8C8FF',
        borderRadius: 16,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>🧭</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#000080', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            Next turn
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#000080', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {instruction}
          </div>
        </div>
      </div>

      {/* ── Destination label ── */}
      {destinationLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '0 4px' }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {destinationLabel}
          </span>
        </div>
      )}

      {/* ── Arrived button (shows when < threshold) ── */}
      {isNearby && onArrived && !arrived && (
        <button
          onClick={() => { setArrived(true); onArrived(); }}
          style={{
            width: '100%', padding: '15px 0',
            background: '#10B981', color: '#fff',
            border: 'none', borderRadius: 16,
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
          }}
        >
          <span style={{ fontSize: 20 }}>✅</span>
          I've arrived!
        </button>
      )}

      {arrived && (
        <div style={{
          width: '100%', padding: '15px 0',
          background: '#F0FDF4', color: '#15803D',
          border: '1.5px solid #86EFAC', borderRadius: 16,
          fontSize: 15, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          You've arrived!
        </div>
      )}
    </div>
  );
}
