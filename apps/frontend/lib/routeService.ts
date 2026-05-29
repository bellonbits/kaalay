/**
 * lib/routeService.ts
 * Routes API v2 wrapper — replaces deprecated DirectionsService.
 * Docs: https://developers.google.com/maps/documentation/routes
 *
 * Key advantages over DirectionsService:
 *  • No BICYCLING ZERO_RESULTS in Africa — falls back to WALK automatically
 *  • HIGH_QUALITY polyline (more detail than overview_path)
 *  • Returns GeoJSON coordinates (no Polyline decoding needed)
 *  • Direct fetch — no SDK dependency
 */

const ROUTES_API_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

// Only request the fields we use — reduces billing cost
const FIELD_MASK = [
  'routes.polyline',
  'routes.distanceMeters',
  'routes.duration',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.endLocation',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
].join(',');

export type TravelModeInput = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Decoded road-mapped coordinates ready for google.maps.Polyline. */
  polylinePoints: google.maps.LatLngLiteral[];
  distanceMeters: number;
  durationSeconds: number;
  /** First maneuver instruction for the NavBanner (may be empty). */
  firstStepInstruction: string;
  /** Resolved travel mode after fallback (e.g. BICYCLING → WALKING). */
  resolvedMode: TravelModeInput;
  /** Individual turn-by-turn navigation steps. */
  steps?: RouteStep[];
}

/** Format distance in meters to a human-readable string. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format duration in seconds to a human-readable string. */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} mins`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) {
    return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
  }
  return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ${remainingMins} mins`;
}

/** Map our internal travel mode to the Routes API enum. */
function toApiMode(mode: TravelModeInput): string {
  // BICYCLING is unsupported in Routes API for most of Africa → fall back to WALK
  if (mode === 'BICYCLING') return 'WALK';
  if (mode === 'WALKING')   return 'WALK';
  if (mode === 'TRANSIT')   return 'TRANSIT';
  return 'DRIVE';
}

/**
 * Fetch a road-mapped route from the Routes API.
 * Returns null on network failure or no-route — callers should fall back to a
 * straight-line bearing in that case.
 */
export async function computeRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  travelMode: TravelModeInput = 'DRIVING',
  apiKey: string,
): Promise<RouteResult | null> {
  if (!apiKey) {
    console.warn('[routeService] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
    return null;
  }



  const resolvedMode = travelMode;
  console.log('[routeService] computing', toApiMode(travelMode), 'route from', origin, 'to', destination);

  const body = {
    origin:      { location: { latLng: { latitude: origin.lat,      longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode:  toApiMode(travelMode),
    polylineQuality: 'HIGH_QUALITY',
    polylineEncoding: 'GEO_JSON_LINESTRING',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls:    false,
      avoidHighways: false,
      avoidFerries:  false,
    },
  };

  try {
    const res = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    console.log('[routeService] status:', res.status);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[routeService] HTTP ${res.status}:`, txt.slice(0, 200));
      // 403 → API key restriction or Routes API not enabled in Cloud Console
      // 400 → bad request (check travel mode / coordinates)
      return null;
    }

    const data = await res.json();
    console.log('[routeService] routes count:', data.routes?.length);
    const route = data.routes?.[0];
    if (!route) {
      console.warn('[routeService] No routes returned', data);
      return null;
    }

    // GEO_JSON_LINESTRING coordinates are [lng, lat] pairs (GeoJSON standard)
    const coordinates: [number, number][] =
      route.polyline?.geoJsonLinestring?.coordinates ?? [];

    if (coordinates.length < 2) {
      console.warn('[routeService] Polyline has fewer than 2 points');
      return null;
    }

    const polylinePoints: google.maps.LatLngLiteral[] = coordinates.map(
      ([lng, lat]) => ({ lat, lng }),
    );

    // Parse duration: Routes API returns e.g. "123s"
    const durationSeconds = parseInt(
      (route.duration ?? '0').replace(/[^0-9]/g, ''),
      10,
    );

    // First step instruction for NavBanner
    const firstStepInstruction =
      (route.legs?.[0]?.steps?.[0]?.navigationInstruction?.instructions ?? '')
        .replace(/<[^>]+>/g, '')
        .trim();

    // Map steps
    const steps: RouteStep[] = [];
    const rawSteps = route.legs?.[0]?.steps ?? [];
    for (const s of rawSteps) {
      const instruction = (s.navigationInstruction?.instructions ?? '')
        .replace(/<[^>]+>/g, '')
        .trim();
      const sDist = s.distanceMeters ?? 0;
      const sDurStr = s.staticDuration || s.duration || '0s';
      const sDur = parseInt(sDurStr.replace(/[^0-9]/g, ''), 10) || 0;
      const lat = s.endLocation?.latLng?.latitude ?? destination.lat;
      const lng = s.endLocation?.latLng?.longitude ?? destination.lng;
      steps.push({
        instruction: instruction || 'Continue along the route',
        distance: formatDistance(sDist),
        duration: formatDuration(sDur),
        lat,
        lng,
      });
    }

    return {
      polylinePoints,
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds,
      firstStepInstruction,
      resolvedMode,
      steps,
    };
  } catch (err) {
    console.warn('[routeService] fetch error:', err);
    return null;
  }
}
