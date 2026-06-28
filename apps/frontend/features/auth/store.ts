import { create } from "zustand";
import { getMe, loginUser, registerUser } from "@/lib/api";
import type { RideCategory, User } from "@/types/api";

/** Where a signed-in user should land — admins and drivers get their own apps. */
export function homeRouteForRole(role?: string | null): string {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "emergency_operator") return "/operator";
  return "/home";
}

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  /** Sends the phone number; backend returns isNewUser if registration is required. */
  requestLogin: (phoneNumber: string) => Promise<{ isNewUser: boolean }>;
  register: (data: {
    phoneNumber: string;
    fullName: string;
    email?: string;
    role?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehicleCategory?: RideCategory;
    licensePlate?: string;
  }) => Promise<void>;
  logout: () => void;
  /** Verifies the stored token against the backend on app start. */
  hydrate: () => Promise<void>;
}

function persistSession(user: User, token: string | null, refreshToken: string | null) {
  if (token) localStorage.setItem("kaalay_token", token);
  if (refreshToken) localStorage.setItem("kaalay_refresh_token", refreshToken);
  localStorage.setItem("kaalay_user", JSON.stringify(user));
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  hydrated: false,

  requestLogin: async (phoneNumber) => {
    set({ loading: true });
    try {
      const res = await loginUser(phoneNumber);
      if (!res.isNewUser && res.user) {
        persistSession(res.user, res.accessToken, res.refreshToken);
        set({ user: res.user });
      }
      return { isNewUser: res.isNewUser };
    } finally {
      set({ loading: false });
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const res = await registerUser({ ...data, role: data.role ?? "rider" });
      if (res.user) {
        persistSession(res.user, res.accessToken, res.refreshToken);
        set({ user: res.user });
      }
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("kaalay_token");
    localStorage.removeItem("kaalay_refresh_token");
    localStorage.removeItem("kaalay_user");
    set({ user: null });
  },

  hydrate: async () => {
    const token = localStorage.getItem("kaalay_token");
    if (!token) {
      set({ hydrated: true });
      return;
    }
    try {
      const user = await getMe();
      localStorage.setItem("kaalay_user", JSON.stringify(user));
      set({ user, hydrated: true });
    } catch {
      localStorage.removeItem("kaalay_token");
      localStorage.removeItem("kaalay_refresh_token");
      localStorage.removeItem("kaalay_user");
      set({ user: null, hydrated: true });
    }
  },
}));
