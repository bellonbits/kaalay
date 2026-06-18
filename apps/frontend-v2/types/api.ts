// TS interfaces mirroring the FastAPI backend's models/enums exactly
// (apps/backend/app/models/all.py). Keep in sync if the backend changes.

export type UserRole = "user" | "rider" | "driver" | "admin" | "emergency_operator";

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

export interface SafetySummary {
  riskTier: "low" | "moderate" | "elevated";
  openIncidentsNearby: number;
  isDaytime: boolean;
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

export interface AiChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AiSuggestedRide {
  category: RideCategory;
  fare: number;
  etaMinutes: number;
  currency: string;
  destination: { lat: number; lng: number; label: string };
}

export interface AiChatResponse {
  reply: string;
  suggestedRide: AiSuggestedRide | null;
}

export type RideStatus = "requested" | "accepted" | "arriving" | "arrived" | "started" | "completed" | "cancelled";

export type RideCategory = "economy" | "motorcycle" | "xl" | "delivery";

export interface RideDriverSummary {
  id: string;
  fullName: string | null;
  phoneNumber: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  rating: number;
  currentLat: number | null;
  currentLng: number | null;
}

export interface RideRiderSummary {
  id: string;
  fullName: string;
  phoneNumber: string;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId: string | null;
  status: RideStatus;
  category: RideCategory;
  pickupLat: number;
  pickupLng: number;
  pickupWhat3words: string;
  destinationLat: number;
  destinationLng: number;
  destinationWhat3words: string;
  fare: number | null;
  distance: number | null;
  duration: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  driver: RideDriverSummary | null;
  rider: RideRiderSummary | null;
}

export interface FareEstimate {
  category: RideCategory;
  fare: number;
  currency: string;
  eta: number;
}

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  vehicleCategory: RideCategory;
  isVerified: boolean;
  status: "online" | "offline" | "busy";
  rating: number;
  acceptanceRate: number;
  currentLat: number | null;
  currentLng: number | null;
}

export interface DriverWallet {
  totalGross: number;
  walletBalance: number;
  commissionPaid: number;
  currency: string;
}

export interface AdminUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string | null;
}

export interface AdminDriver {
  id: string;
  userId: string;
  fullName: string | null;
  phoneNumber: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  vehicleCategory: RideCategory;
  nationalIdUrl: string | null;
  drivingLicenseUrl: string | null;
  isVerified: boolean;
  status: "online" | "offline" | "busy";
  rating: number;
  acceptanceRate: number;
}

export interface AdminDashboardStats {
  activeTrips: number;
  completedTrips: number;
  totalDrivers: number;
  verifiedDrivers: number;
  totalRevenue: number;
}

export interface AdminIncidentStats {
  open: number;
  dispatched: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export interface AdminTrip {
  id: string;
  status: RideStatus;
  category: RideCategory;
  pickup: string;
  destination: string;
  fare: number | null;
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
