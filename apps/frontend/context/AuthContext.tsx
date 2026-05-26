'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getMe } from '../lib/api';

interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: string;
  vehicleCategory?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const login = (user: User, token: string, refreshToken: string) => {
    localStorage.setItem('kaalay_token', token);
    localStorage.setItem('kaalay_refresh_token', refreshToken);
    localStorage.setItem('kaalay_user', JSON.stringify(user));
    setUser(user);
    router.push('/home');
  };

  const logout = () => {
    localStorage.removeItem('kaalay_token');
    localStorage.removeItem('kaalay_refresh_token');
    localStorage.removeItem('kaalay_user');
    setUser(null);
    router.push('/auth');
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('kaalay_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      if (pathname !== '/auth' && pathname !== '/') router.push('/auth');
      return;
    }

    try {
      const userData = await getMe();
      setUser(userData);
      localStorage.setItem('kaalay_user', JSON.stringify(userData));
    } catch (err) {
      console.error('Auth check failed', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
