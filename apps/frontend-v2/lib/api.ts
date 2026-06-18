import axios, { type AxiosError } from "axios";
import type {
  AdminDashboardStats,
  AdminDriver,
  AdminIncidentStats,
  AdminTrip,
  AdminUser,
  AiChatMessage,
  AiChatResponse,
  AuthResponse,
  AutosuggestSuggestion,
  DistanceResponse,
  DriverProfile,
  DriverWallet,
  EmergencyContact,
  EmergencyFacility,
  EmergencySeverity,
  EmergencyType,
  FareEstimate,
  Incident,
  IncidentStatus,
  Place,
  Ride,
  RideCategory,
  RideStatus,
  SafetySummary,
  ShareSession,
  SosResponse,
  User,
  W3WConvertToCoordsResponse,
  W3WConvertToWordsResponse,
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://app.suqafuran.com/api/v1";

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((cfg) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("kaalay_token");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Unwraps the backend's {success, data, message} envelope and handles
// token refresh on 401 — ported from the working axios setup in the
// previous Kaalay frontend.
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success === true) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error: AxiosError<{ detail?: { error?: { code: string; message: string } }; error?: { code: string; message: string } }>) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("kaalay_refresh_token");
        if (refreshToken) {
          const res = await axios.post(`${BASE}/auth/refresh-token?refreshToken=${refreshToken}`);
          if (res.data?.success) {
            const newAccessToken = res.data.data.accessToken;
            localStorage.setItem("kaalay_token", newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        localStorage.removeItem("kaalay_token");
        localStorage.removeItem("kaalay_refresh_token");
        localStorage.removeItem("kaalay_user");
        if (typeof window !== "undefined") window.location.href = "/welcome";
      }
    }

    const data = error.response?.data;
    if (data?.detail?.error) return Promise.reject(data.detail.error);
    if (data?.error) return Promise.reject(data.error);
    return Promise.reject(error);
  }
);

// ── Auth (passwordless, phone-based — see plan's documented deviation) ────
export const loginUser = (phoneNumber: string) =>
  api.post<AuthResponse>("/auth/login", { phoneNumber }).then((r) => r.data);

export const registerUser = (data: {
  phoneNumber: string;
  fullName: string;
  email?: string;
  role?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleCategory?: RideCategory;
  licensePlate?: string;
}) => api.post<AuthResponse>("/auth/register", data).then((r) => r.data);

export const getMe = () => api.get<User>("/auth/me").then((r) => r.data);

export const updateProfile = (data: { fullName?: string }) =>
  api.patch<User>("/auth/me", data).then((r) => r.data);

// ── Location / what3words ──────────────────────────────────────────────
export const convertToWords = (lat: number, lng: number) =>
  api.get<W3WConvertToWordsResponse>(`/location/convert-to-words`, { params: { lat, lng } }).then((r) => r.data);

export const convertToCoordinates = (words: string) =>
  api.get<W3WConvertToCoordsResponse>(`/location/convert-to-coordinates`, { params: { words } }).then((r) => r.data);

export const getDistance = (fromLat: number, fromLng: number, toLat: number, toLng: number) =>
  api.get<DistanceResponse>(`/location/distance`, { params: { fromLat, fromLng, toLat, toLng } }).then((r) => r.data);

export const getSafetySummary = (lat: number, lng: number) =>
  api.get<SafetySummary>(`/location/safety-summary`, { params: { lat, lng } }).then((r) => r.data);

export const autosuggest = (input: string, lat?: number, lng?: number) =>
  api
    .get<{ suggestions: AutosuggestSuggestion[] }>(`/location/autosuggest`, { params: { input, lat, lng } })
    .then((r) => r.data);

export const getGridSection = (swLat: number, swLng: number, neLat: number, neLng: number) =>
  api
    .get<{ type: "FeatureCollection"; features: unknown[] }>(`/location/grid`, {
      params: { sw_lat: swLat, sw_lng: swLng, ne_lat: neLat, ne_lng: neLng },
    })
    .then((r) => r.data);

export interface SnappedPoint {
  lat: number;
  lng: number;
  placeId?: string;
  originalIndex?: number;
}

export const snapToRoad = (points: { lat: number; lng: number }[]) =>
  api
    .post<{ snappedPoints: SnappedPoint[] }>(`/location/snap-to-road`, { points })
    .then((r) => r.data);

// ── Live location sharing ──────────────────────────────────────────────
export const createShareSession = (data: {
  lat: number;
  lng: number;
  accuracy?: number;
  requestType?: string;
  visibility?: string;
  message?: string;
  expiresIn?: number;
}) => api.post<ShareSession>("/location/share", data).then((r) => r.data);

export const getSharedLocation = (token: string) =>
  api.get(`/location/share/${token}`).then((r) => r.data);

export const updateShareSession = (token: string, data: { lat?: number; lng?: number; status?: string }) =>
  api.patch(`/location/share/${token}`, data).then((r) => r.data);

// ── Emergency (Kaaley Heedhe) ───────────────────────────────────────────
export const triggerEmergencySos = (data: {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  w3w?: string;
  message?: string;
  type?: EmergencyType;
  severity?: EmergencySeverity;
  silent?: boolean;
}) => api.post<SosResponse>("/emergency/sos", data).then((r) => r.data);

export const getIncident = (id: string) => api.get<Incident>(`/emergency/incidents/${id}`).then((r) => r.data);

export const updateIncidentStatus = (id: string, status: IncidentStatus) =>
  api.patch<Incident>(`/emergency/incidents/${id}`, { status }).then((r) => r.data);

export const listTrustedContacts = () =>
  api.get<EmergencyContact[]>("/emergency/contacts").then((r) => r.data);

export const addTrustedContact = (data: { name: string; phoneNumber: string; relationship?: string }) =>
  api.post<EmergencyContact>("/emergency/contacts", data).then((r) => r.data);

export const deleteTrustedContact = (id: string) =>
  api.delete<{ id: string; deleted: true }>(`/emergency/contacts/${id}`).then((r) => r.data);

export const getNearestFacilities = (lat: number, lng: number, type?: FacilityTypeParam, limit = 5) =>
  api.get<EmergencyFacility[]>("/emergency/nearest", { params: { lat, lng, type, limit } }).then((r) => r.data);

type FacilityTypeParam = "hospital" | "clinic" | "police" | "fire" | "ambulance" | undefined;

// ── Places (search destination by name, saved locations) ──────────────
export const getNearbyPlaces = (lat: number, lng: number, radius = 0.1) =>
  api.get<Place[]>("/places/nearby", { params: { lat, lng, radius } }).then((r) => r.data);

export const searchPlaces = (q: string) => api.get<Place[]>("/places/search", { params: { q } }).then((r) => r.data);

export const createPlace = (data: {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  words: string;
  tags?: string[];
  photos?: string[];
  alwaysOpen?: boolean;
  openTime?: string;
  closeTime?: string;
}) => api.post<Place>("/places", data).then((r) => r.data);

export const getPlaces = () => api.get<Place[]>("/places").then((r) => r.data);

export const getPlace = (id: string) => api.get<Place>(`/places/${id}`).then((r) => r.data);

// ── Rides (ride-hailing) ────────────────────────────────────────────────
export const getFareEstimates = (distance: number, category?: RideCategory) =>
  api.post<FareEstimate[]>("/rides/estimate", { distance, category }).then((r) => r.data);

export const createRide = (data: {
  pickup: { lat: number; lng: number; words: string };
  destination: { lat: number; lng: number; words: string };
  category?: RideCategory;
  distance?: number;
  duration?: number;
}) => api.post<Ride>("/rides", data).then((r) => r.data);

export const sendAiChatMessage = (data: { message: string; history: AiChatMessage[]; lat: number; lng: number }) =>
  api.post<AiChatResponse>("/ai/chat", data).then((r) => r.data);

export const getRide = (id: string) => api.get<Ride>(`/rides/${id}`).then((r) => r.data);

export const getRideHistory = () => api.get<Ride[]>("/rides/history").then((r) => r.data);

export const getNearbyRides = () => api.get<Ride[]>("/rides/nearby").then((r) => r.data);

export const acceptRide = (id: string) => api.post<Ride>(`/rides/${id}/accept`).then((r) => r.data);

export const signalRideArriving = (id: string) => api.patch<Ride>(`/rides/${id}/arriving`).then((r) => r.data);

export const signalRideArrived = (id: string) => api.patch<Ride>(`/rides/${id}/arrived`).then((r) => r.data);

export const startRide = (id: string) => api.patch<Ride>(`/rides/${id}/start`).then((r) => r.data);

export const completeRide = (id: string) => api.patch<Ride>(`/rides/${id}/complete`).then((r) => r.data);

export const cancelRide = (id: string) => api.patch<Ride>(`/rides/${id}/cancel`).then((r) => r.data);

export const rateRide = (id: string, rating: number, comment?: string) =>
  api.post(`/rides/${id}/rating`, { rating, comment }).then((r) => r.data);

export const updateDriverRideLocation = (
  id: string,
  data: { lat: number; lng: number; heading?: number; speed?: number }
) => api.patch<{ distanceMeters: number }>(`/rides/${id}/location`, data).then((r) => r.data);

// ── Drivers ──────────────────────────────────────────────────────────────
export const registerDriver = (data: {
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  vehicleCategory?: RideCategory;
  nationalIdUrl?: string;
  drivingLicenseUrl?: string;
}) => api.post<DriverProfile>("/drivers/register", data).then((r) => r.data);

export const getMyDriverProfile = () => api.get<DriverProfile>("/drivers/me").then((r) => r.data);

export const updateDriverStatus = (status: "online" | "offline" | "busy") =>
  api.patch<{ status: string }>("/drivers/status", null, { params: { status } }).then((r) => r.data);

export const getDriverWallet = () => api.get<DriverWallet>("/drivers/wallet").then((r) => r.data);

// ── Admin ────────────────────────────────────────────────────────────────
export const getAdminDashboardStats = () => api.get<AdminDashboardStats>("/admin/dashboard-stats").then((r) => r.data);

export const getAdminActiveTrips = () => api.get<AdminTrip[]>("/admin/active-trips").then((r) => r.data);

export const getAdminUsers = (q?: string) => api.get<AdminUser[]>("/admin/users", { params: { q } }).then((r) => r.data);

export const updateAdminUser = (id: string, data: { isActive?: boolean; role?: string }) =>
  api.patch<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data);

export const getAdminDrivers = (verified?: boolean) =>
  api.get<AdminDriver[]>("/admin/drivers", { params: { verified } }).then((r) => r.data);

export const verifyAdminDriver = (id: string, isVerified: boolean) =>
  api.patch<AdminDriver>(`/admin/drivers/${id}/verify`, { isVerified }).then((r) => r.data);

export const forceAdminDriverStatus = (id: string, status: "online" | "offline" | "busy") =>
  api.patch<AdminDriver>(`/admin/drivers/${id}/status`, { status }).then((r) => r.data);

export const getAdminRides = (status?: RideStatus) =>
  api.get<Ride[]>("/admin/rides", { params: { status } }).then((r) => r.data);

export const forceCancelAdminRide = (id: string) => api.patch<Ride>(`/admin/rides/${id}/cancel`).then((r) => r.data);

export const getAdminIncidents = (status?: IncidentStatus) =>
  api.get<Incident[]>("/admin/incidents", { params: { status } }).then((r) => r.data);

export const getAdminIncidentStats = () =>
  api.get<AdminIncidentStats>("/admin/incidents/stats").then((r) => r.data);

export const updateAdminIncident = (id: string, status: IncidentStatus) =>
  api.patch<{ id: string; status: IncidentStatus; resolvedAt: string | null }>(`/admin/incidents/${id}`, { status }).then((r) => r.data);

export const updateAdminPlace = (id: string, data: Partial<{
  name: string;
  description: string;
  tags: string[];
  photos: string[];
  alwaysOpen: boolean;
  openTime: string;
  closeTime: string;
}>) => api.patch<Place>(`/places/${id}`, data).then((r) => r.data);

export const deleteAdminPlace = (id: string) => api.delete<{ id: string; deleted: true }>(`/places/${id}`).then((r) => r.data);
