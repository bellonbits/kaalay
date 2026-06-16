// Thin wrapper around the Google Places JS SDK (already loaded via the
// `libraries=places` script tag in app/layout.tsx). Uses the classic
// AutocompleteService/PlacesService — deprecated in favor of the new
// `Place` class, but still functional and far better documented; given
// this needs to work correctly without a live test harness for the newest
// API surface, reliability wins over using the absolute latest API.

export interface GooglePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface GooglePlaceDetail {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  isOpenNow: boolean | null;
  photoUrls: string[];
  types: string[];
}

export interface GoogleNearbyPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  type: "hospital" | "police" | "fire_station";
  vicinity: string;
}

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

function getAutocompleteService() {
  if (!autocompleteService) autocompleteService = new google.maps.places.AutocompleteService();
  return autocompleteService;
}

function getPlacesService() {
  if (!placesService) placesService = new google.maps.places.PlacesService(document.createElement("div"));
  return placesService;
}

/**
 * Real nearby-emergency-facility search via Google Places, used to back
 * up Kaalay's own (sparse, hand-seeded) facility list — so "Nearby Help"
 * actually finds something close in neighborhoods we haven't manually
 * seeded yet, instead of only ever returning whatever's nearest among a
 * handful of central-Nairobi entries.
 */
export function searchNearbyEmergencyPlaces(
  lat: number,
  lng: number,
  type: "hospital" | "police" | "fire_station",
  radiusMeters = 6000
): Promise<GoogleNearbyPlace[]> {
  if (typeof google === "undefined" || !google.maps?.places) return Promise.resolve([]);
  return new Promise((resolve) => {
    getPlacesService().nearbySearch(
      { location: new google.maps.LatLng(lat, lng), radius: radiusMeters, type },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          resolve([]);
          return;
        }
        resolve(
          results
            .filter((r) => r.geometry?.location && r.place_id)
            .map((r) => ({
              placeId: r.place_id!,
              name: r.name ?? "Unnamed",
              lat: r.geometry!.location!.lat(),
              lng: r.geometry!.location!.lng(),
              type,
              vicinity: r.vicinity ?? "",
            }))
        );
      }
    );
  });
}

/** Call once when a search session starts (e.g. when the search sheet opens) — bills as one session instead of per-keystroke. */
export function newPlacesSession() {
  sessionToken = new google.maps.places.AutocompleteSessionToken();
}

export function searchGooglePlaces(query: string, near?: { lat: number; lng: number } | null): Promise<GooglePrediction[]> {
  if (typeof google === "undefined" || !google.maps?.places) return Promise.resolve([]);
  return new Promise((resolve) => {
    getAutocompleteService().getPlacePredictions(
      {
        input: query,
        sessionToken: sessionToken ?? undefined,
        ...(near ? { location: new google.maps.LatLng(near.lat, near.lng), radius: 50000 } : {}),
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          }))
        );
      }
    );
  });
}

export function getGooglePlaceDetails(placeId: string): Promise<GooglePlaceDetail | null> {
  if (typeof google === "undefined" || !google.maps?.places) return Promise.resolve(null);
  return new Promise((resolve) => {
    getPlacesService().getDetails(
      {
        placeId,
        sessionToken: sessionToken ?? undefined,
        fields: ["name", "formatted_address", "geometry", "photos", "rating", "opening_hours", "types"],
      },
      (place, status) => {
        sessionToken = null; // session ends once details are fetched
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve({
          placeId,
          name: place.name ?? "",
          address: place.formatted_address ?? "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          rating: place.rating,
          isOpenNow: place.opening_hours?.isOpen?.() ?? null,
          photoUrls: (place.photos ?? []).slice(0, 6).map((p) => p.getUrl({ maxWidth: 800 })),
          types: place.types ?? [],
        });
      }
    );
  });
}
