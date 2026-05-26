import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://app.suqafuran.com/api/v1';

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kaalay_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Response interceptor to handle the v1 standard response format and token rotation
api.interceptors.response.use(
  response => {
    // If the response follows our v1 format { success: true, data: ... }
    if (response.data && response.data.success === true) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Auto-Refresh Token Logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('kaalay_refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${BASE}/auth/refresh-token?refreshToken=${refreshToken}`);
          if (res.data && res.data.success) {
            const newAccessToken = res.data.data.accessToken;
            localStorage.setItem('kaalay_token', newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // If refresh fails, purge session and force re-authentication
        localStorage.removeItem('kaalay_token');
        localStorage.removeItem('kaalay_refresh_token');
        localStorage.removeItem('kaalay_user');
        if (typeof window !== 'undefined') window.location.href = '/auth';
      }
    }
    
    // Handle standardized error format from FastAPI detail
    const detail = error.response?.data?.detail;
    if (detail && detail.error) {
      return Promise.reject(detail.error);
    }
    // Fallback for non-detailed errors
    if (error.response?.data?.error) {
      return Promise.reject(error.response.data.error);
    }
    return Promise.reject(error);
  }
);

// ── Auth & Users ──────────────────────────────────────────────────────────
export const loginUser = (data: { phoneNumber: string; password?: string }) =>
  api.post('/auth/login', data).then(r => r.data);

export const registerUser = (data: { fullName: string; phoneNumber: string; email?: string; password?: string; role?: string }) =>
  api.post('/auth/register', data).then(r => r.data);

export const getMe = () =>
  api.get('/auth/me').then(r => r.data);

export const updateProfile = (data: { fullName: string }) =>
  api.patch('/users/me', data).then(r => r.data);

// ── Location (what3words) ─────────────────────────────────────────────────
export const convertToWords = (lat: number, lng: number) =>
  api.get(`/location/convert-to-words?lat=${lat}&lng=${lng}`).then(r => r.data);

export const convertToCoordinates = (words: string) =>
  api.get(`/location/convert-to-coordinates?words=${encodeURIComponent(words)}`).then(r => r.data);

export const getDistance = (fromWords: string, toWords: string) =>
  api.get(`/location/distance?fromWords=${encodeURIComponent(fromWords)}&toWords=${toWords}`).then(r => r.data);

export const getGridSection = (swLat: number, swLng: number, neLat: number, neLng: number) =>
  api.get(`/location/grid?sw_lat=${swLat}&sw_lng=${swLng}&ne_lat=${neLat}&ne_lng=${neLng}`).then(r => r.data);

// ── Live Location Sharing ────────────────────────────────────────────────
export const createShareSession = (data: {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  expiresIn?: number;
  accuracy?: number;
  requestType?: string;
  visibility?: string;
  userId?: string;
  message?: string;
}) => api.post('/location/share', data).then(r => r.data);

export const getSharedLocation = (token: string) =>
  api.get(`/location/share/${token}`).then(r => r.data);

// ── Rides ─────────────────────────────────────────────────────────────────
export const requestRide = (data: {
  pickup: { lat: number; lng: number; words: string };
  destination: { lat: number; lng: number; words: string };
  category?: string;
  distance?: number;
  duration?: number;
}) => api.post('/rides', data).then(r => r.data);

export const getRide = (id: string) =>
  api.get(`/rides/${id}`).then(r => r.data);

export const getRideHistory = () =>
  api.get('/rides/history').then(r => r.data);

export const cancelRide = (id: string) =>
  api.patch(`/rides/${id}/cancel`).then(r => r.data);

export const updateRideStatus = (id: string, status: string) =>
  api.patch(`/rides/${id}/status`, { status }).then(r => r.data);

// ── Driver Ride Actions ──────────────────────────────────────────────────
export const acceptRide = (id: string) =>
  api.post(`/rides/${id}/accept`).then(r => r.data);

export const startRide = (id: string) =>
  api.patch(`/rides/${id}/start`).then(r => r.data);

export const completeRide = (id: string) =>
  api.patch(`/rides/${id}/complete`).then(r => r.data);

// ── Drivers ───────────────────────────────────────────────────────────────
export const registerDriver = (data: { vehicleModel: string; vehicleColor: string; licensePlate: string }) =>
  api.post('/drivers/register', data).then(r => r.data);

export const getDriverMe = () =>
  api.get('/drivers/me').then(r => r.data);

export const updateDriverStatus = (status: 'online' | 'offline' | 'busy') =>
  api.patch('/drivers/status', { status }).then(r => r.data);

// ── Notifications ──────────────────────────────────────────────────────────
export const getNotifications = () =>
  api.get('/notifications').then(r => r.data);

export const markNotificationRead = (id: string) =>
  api.patch(`/notifications/${id}/read`).then(r => r.data);

// ── Places (Discovery) ───────────────────────────────────────────────────
export const createPlace = (data: {
  name: string; description?: string;
  lat: number; lng: number; words: string;
  tags?: string[];
}) => api.post('/places', data).then(r => r.data);

export const getPlace = (id: string) =>
  api.get(`/places/${id}`).then(r => r.data);

export const getPlaces = () =>
  api.get('/places').then(r => r.data);

export const getNearbyPlaces = (lat: number, lng: number, radius?: number) =>
  api.get(`/places/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`).then(r => r.data);

export const searchPlaces = (query: string) =>
  api.get(`/places/search?q=${encodeURIComponent(query)}`).then(r => r.data);

// ── Compatibility Aliases (Legacy names) ───────────────────────────
export const convertTo3wa = (lat: number, lng: number) => 
  convertToWords(lat, lng).then(data => ({ what3words: data.words }));

export const createSession = createShareSession;
export const getSessionByCode = getSharedLocation;
export const getNearbyRides = () =>
  api.get('/rides/nearby').then(r => r.data);

export const getFareEstimates = (data: any) =>
  api.post('/rides/estimate', data).then(r => r.data);

export const signalArriving = (id: string) =>
  api.patch(`/rides/${id}/arriving`).then(r => r.data);

export const signalArrived = (id: string) =>
  api.patch(`/rides/${id}/arrived`).then(r => r.data);

export const getAdminStats = () =>
  api.get('/admin/dashboard-stats').then(r => r.data);

export const getActiveTrips = () =>
  api.get('/admin/active-trips').then(r => r.data);

export const getDriverWallet = () =>
  api.get('/drivers/wallet').then(r => r.data);

export const submitRating = (id: string, data: { rating: number, comment?: string }) =>
  api.post(`/rides/${id}/rating`, data).then(r => r.data);

export const getPublicSessions = getNearbyRides;
export const getDistanceAndDuration = getDistance;

export const updateSessionStatus = (token: string, data: any) =>
  api.patch(`/location/share/${token}`, data).then(r => r.data);

export const autosuggest = (input: string, focus?: { lat: number; lng: number }) => {
  let url = `/location/autosuggest?input=${encodeURIComponent(input)}`;
  if (focus) url += `&lat=${focus.lat}&lng=${focus.lng}`;
  return api.get(url).then(r => r.data);
};
