// TS interfaces mirroring the FastAPI backend's models/enums exactly
// (apps/backend/app/models/all.py). Keep in sync if the backend changes.

export type UserRole = "user" | "rider" | "driver" | "admin";

export type EmergencyType =
  | "medical"
  | "police"
  | "violence"
  | "kidnapping"
  | "fire"
  | "disaster"
  | "lost_person";

export type EmergencySeverity = "green" | "yellow" | "orange" | "red" | "black";

export type IncidentStatus = "open" | "dispatched" | "resolved" | "cancelled";

export type FacilityType = "hospital" | "clinic" | "police" | "fire" | "ambulance";

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  role: UserRole;
  vehicleCategory?: string;
}

export interface AuthResponse {
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isNewUser: boolean;
}

export interface W3WConvertToWordsResponse {
  words: string;
  lat: number;
  lng: number;
  warning?: string;
}

export interface W3WConvertToCoordsResponse {
  latitude: number;
  longitude: number;
  what3words: string;
  warning?: string;
}

export interface DistanceResponse {
  distance: string;
  distanceKm: number;
  duration: string;
  durationMins: number;
  estimate: number;
}

export interface AutosuggestSuggestion {
  words: string;
  nearestPlace: string;
  country: string;
}

export interface ShareSession {
  token: string;
  shareCode: string;
  shareUrl: string;
  expiresIn: number;
}

export interface Place {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  words: string;
  tags: string[];
  photos: string[];
  alwaysOpen: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  /** null when there's no hours data to judge by. */
  isOpenNow: boolean | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  type: EmergencyType;
  severity: EmergencySeverity;
  status: IncidentStatus;
  silent: boolean;
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  what3words?: string | null;
  message?: string | null;
  shareToken?: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export interface SosResponse {
  incident: Incident;
  token: string;
  shareCode: string;
  contacts: { name: string; phoneNumber: string }[];
  notifiedUserIds: string[];
  expiresIn: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship?: string | null;
  createdAt: string | null;
}

export interface EmergencyFacility {
  id: string;
  name: string;
  type: FacilityType;
  lat: number;
  lng: number;
  phoneNumber?: string | null;
  city?: string | null;
  distanceKm: number;
}
