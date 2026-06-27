/**
 * lib/share.ts
 * Invite sharing + geo helpers shared by Meet and Share.
 *
 * shareInvite() opens the OS share sheet via the Web Share API — which works
 * inside the Capacitor WebView (iOS/Android) and mobile browsers — and falls
 * back to clipboard when unavailable. No native plugin required.
 */

export type ShareOutcome = 'shared' | 'copied' | 'failed';

export interface InvitePayload {
  title: string;
  text: string;
  url: string;
}

/** Open the native share sheet, falling back to clipboard. */
export async function shareInvite(payload: InvitePayload): Promise<ShareOutcome> {
  const { title, text, url } = payload;

  // Web Share API → native sheet (WhatsApp, SMS, AirDrop, etc.)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err: any) {
      // AbortError = user dismissed the sheet; treat as a no-op, not a failure
      if (err?.name === 'AbortError') return 'shared';
      // fall through to clipboard
    }
  }

  return (await copyText(`${text} ${url}`.trim())) ? 'copied' : 'failed';
}

/** Copy text to the clipboard with a legacy fallback. Returns success. */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through */ }

  // Legacy fallback for non-secure contexts / older WebViews
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = value;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

// ── Geo helpers ─────────────────────────────────────────────────────────────

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** "120 m" / "1.4 km" */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Walking ETA from a distance, assuming ~5 km/h. "4 min" / "now". */
export function walkEta(metres: number): string {
  const mins = Math.round(metres / 1000 / 5 * 60);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
