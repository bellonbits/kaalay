// Pure geodesic helpers reused across navigation, precision mode, Meet
// (ETA to host), and Share (viewer distance) — no framework dependencies.

const R_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_KM * c;
}

/** Great-circle distance in metres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/** Initial bearing in degrees (0 = north, clockwise). */
export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Forward geodesic — the point `distanceMeters` away from (lat, lng) along
 * `bearingDeg`. Used to bias the follow-camera ahead of the live position so
 * more of the upcoming route is visible, and to project a point onto a
 * route polyline for deviation checks. */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceMeters: number): { lat: number; lng: number } {
  const delta = distanceMeters / (R_KM * 1000);
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lng);

  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 =
    lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));

  return { lat: toDeg(phi2), lng: toDeg(lambda2) };
}

/** Shortest distance from a point to a polyline (sequence of segments),
 * approximated by checking distance to every segment via the nearest point
 * on that segment — fine-grained enough for route-deviation detection at
 * walking/driving GPS update rates without needing a full geodesic
 * point-to-line projection. */
export function distanceToPolyline(point: { lat: number; lng: number }, polyline: { lat: number; lng: number }[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point.lat, point.lng, polyline[0].lat, polyline[0].lng);

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    // Project point onto segment a-b in a local equirectangular approximation
    // (fine over the short segment lengths route polylines use).
    const ax = a.lng, ay = a.lat, bx = b.lng, by = b.lat, px = point.lng, py = point.lat;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const closest = { lat: ay + t * dy, lng: ax + t * dx };
    const dist = haversineMeters(point.lat, point.lng, closest.lat, closest.lng);
    if (dist < min) min = dist;
  }
  return min;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Maps a bearing (0-360) to one of 8 cardinal directions. */
export function cardinalDirection(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8];
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Move/interval gate shared by every hook that throttles pushes to the
 * backend off a GPS stream (share-session push, road-snap requests, ride
 * location pushes) — fires only once the position has moved far enough or
 * enough time has passed, whichever comes first.
 */
export function shouldPush(
  last: { lat: number; lng: number; time: number } | null,
  next: { lat: number; lng: number },
  minMoveMetres: number,
  minIntervalMs: number
): boolean {
  if (!last) return true;
  const moved = haversineMeters(last.lat, last.lng, next.lat, next.lng);
  return moved >= minMoveMetres || Date.now() - last.time >= minIntervalMs;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs} hour${hrs === 1 ? "" : "s"}${rem ? ` ${rem} min${rem === 1 ? "" : "s"}` : ""}`;
}
