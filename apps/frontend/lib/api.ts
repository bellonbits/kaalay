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

// ── Users ─────────────────────────────────────────────────────────────────
export const createUser = (data: { fullName: string; phoneNumber: string; role?: string }) =>
  api.post('/users', data).then(r => r.data);
