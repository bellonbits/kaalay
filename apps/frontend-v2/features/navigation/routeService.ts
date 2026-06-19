// Google Routes API v2 client — deliberately NOT the deprecated
// DirectionsService. Routes API falls back to WALK automatically instead of
// returning BICYCLING ZERO_RESULTS in places Google hasn't mapped cycling
// infra for (common across rural/unmapped Africa), and GEO_JSON_LINESTRING
// encoding means no manual polyline decoding. Ported from the previous
// Kaalay frontend's proven routeService.

import { haversineMeters } from "@/features/location/geo";

export type ApiTravelMode = "WALK" | "BICYCLE" | "DRIVE" | "TWO_WHEELER" | "TRANSIT";

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  endLat: number;
  endLng: number;
}

export interface RouteResult {
  polylinePoints: { lat: number; lng: number }[];
  distanceMeters: number;
  durationSeconds: number;
  firstStepInstruction: string;
  steps: RouteStep[];
}

function toApiMode(mode: "WALKING" | "TWO_WHEELER" | "DRIVING"): ApiTravelMode {
  if (mode === "WALKING") return "WALK";
  if (mode === "TWO_WHEELER") return "TWO_WHEELER";
  return "DRIVE";
}

export async function computeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: "WALKING" | "TWO_WHEELER" | "DRIVING",
  apiKey: string
): Promise<RouteResult | null> {
  const apiMode = toApiMode(travelMode);

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.endLocation",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: apiMode,
        polylineEncoding: "GEO_JSON_LINESTRING",
        ...(apiMode === "BICYCLE" || apiMode === "WALK" ? {} : { routingPreference: "TRAFFIC_AWARE" }),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const coords: [number, number][] = route.polyline?.geoJsonLinestring?.coordinates ?? [];
    let polylinePoints = coords.map(([lng, lat]) => ({ lat, lng }));

    // Google snaps the route to the nearest road, which leaves a visible
    // gap if the user is inside a building or off-road. Always stitch the
    // exact GPS/pin coordinates onto both ends — unconditionally, not just
    // past some gap threshold — so the line starts and ends EXACTLY where
    // the user and destination actually are, never at a snapped road point.
    if (polylinePoints.length > 0) {
      const first = polylinePoints[0];
      const last = polylinePoints[polylinePoints.length - 1];
      if (haversineMeters(origin.lat, origin.lng, first.lat, first.lng) > 0.5) {
        polylinePoints = [{ lat: origin.lat, lng: origin.lng }, ...polylinePoints];
      }
      if (haversineMeters(destination.lat, destination.lng, last.lat, last.lng) > 0.5) {
        polylinePoints = [...polylinePoints, { lat: destination.lat, lng: destination.lng }];
      }
    } else {
      // No road geometry at all — draw a direct line so there's still a
      // visible connection from origin to destination instead of nothing.
      polylinePoints = [
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      ];
    }

    const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      instruction: s.navigationInstruction?.instructions ?? "Continue",
      distanceMeters: s.distanceMeters ?? 0,
      endLat: s.endLocation?.latLng?.latitude ?? destination.lat,
      endLng: s.endLocation?.latLng?.longitude ?? destination.lng,
    }));

    return {
      polylinePoints,
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0,
      firstStepInstruction: steps[0]?.instruction ?? "Head to your destination",
      steps,
    };
  } catch {
    return null;
  }
}
