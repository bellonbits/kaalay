import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kaalay_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// ── Sessions ──────────────────────────────────────────────────────────────
export const createSession = (data: {
  latitude: number; longitude: number; accuracy?: number;
  requestType?: string; visibility?: string; message?: string; expiresAt?: string;
  userId?: string;
}) => api.post('/sessions', data).then(r => r.data);

export const getSessionByCode = (code: string) =>
  api.get(`/sessions/code/${code}`).then(r => r.data);

export const getPublicSessions = () =>
  api.get('/sessions/public').then(r => r.data);

export const updateSessionStatus = (code: string, status: string) =>
  api.patch(`/sessions/${code}/status`, { status }).then(r => r.data);

// ── Location (what3words) ─────────────────────────────────────────────────
export const convertTo3wa = (lat: number, lng: number) =>
  api.get(`/location/convert-to-3wa?lat=${lat}&lng=${lng}`).then(r => r.data as { what3words: string; latitude: number; longitude: number });

export const convertToCoordinates = (words: string) =>
  api.get(`/location/convert-to-coordinates?words=${encodeURIComponent(words)}`).then(r => r.data);

export const getDistanceAndDuration = (oLat: number, oLng: number, dLat: number, dLng: number) =>
  api.get(`/location/distance`, {
    params: { originLat: oLat, originLng: oLng, destLat: dLat, destLng: dLng }
  }).then(r => r.data);

export const getGridSection = (swLat: number, swLng: number, neLat: number, neLng: number) =>
  api.get(`/location/grid-section`, {
    params: { swLat, swLng, neLat, neLng }
  }).then(r => r.data);

// ── Users ─────────────────────────────────────────────────────────────────
export const createUser = (data: { fullName: string; phoneNumber: string; role?: string }) =>
  api.post('/users', data).then(r => r.data);

// ── Rides ─────────────────────────────────────────────────────────────────
export const requestRide = (data: {
  riderId: string;
  pickupWhat3words: string; pickupLat: number; pickupLng: number;
  destinationWhat3words: string; destinationLat?: number; destinationLng?: number;
}) => api.post('/rides', data).then(r => r.data);

export const getRide = (id: string) =>
  api.get(`/rides/${id}`).then(r => r.data);

export const updateRideStatus = (id: string, status: string) =>
  api.patch(`/rides/${id}/status`, { status }).then(r => r.data);

export const getRiderRides = (riderId: string) =>
  api.get(`/rides/rider/${riderId}`).then(r => r.data);

export const getDriverRides = (driverId: string) =>
  api.get(`/rides/driver/${driverId}`).then(r => r.data);

// ── Drivers ───────────────────────────────────────────────────────────────
export const registerDriver = (data: { userId: string; vehicleModel: string; vehicleColor: string; licensePlate: string }) =>
  api.post('/drivers', data).then(r => r.data);

export const getDriverByUser = (userId: string) =>
  api.get(`/drivers/user/${userId}`).then(r => r.data);

export const updateDriverStatus = (driverId: string, status: string) =>
  api.patch(`/drivers/${driverId}/status`, { status }).then(r => r.data);

// ── Places (Local Discovery) ──────────────────────────────────────────────
export const createPlace = (data: {
  name: string; description?: string;
  latitude: number; longitude: number; what3words: string;
  tags?: string[]; photos?: string[]; userId?: string;
}) => api.post('/places', data).then(r => r.data);

export const getNearbyPlaces = (lat: number, lng: number, radius = 2) =>
  api.get(`/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).then(r => r.data);

export const searchPlaces = (query: string) =>
  api.get(`/places/search?q=${encodeURIComponent(query)}`).then(r => r.data);

export const getPlace = (id: string) =>
  api.get(`/places/${id}`).then(r => r.data);
