import axios, { type AxiosError } from "axios";
import type {
  AuthResponse,
  AutosuggestSuggestion,
  DistanceResponse,
  EmergencyContact,
  EmergencyFacility,
  EmergencySeverity,
  EmergencyType,
  Incident,
  IncidentStatus,
  Place,
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

export const registerUser = (data: { phoneNumber: string; fullName: string; email?: string; role?: string }) =>
  api.post<AuthResponse>("/auth/register", data).then((r) => r.data);

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
