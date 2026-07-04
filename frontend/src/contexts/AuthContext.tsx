import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'organiser' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: string }) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('tc_token');
    const storedUser = localStorage.getItem('tc_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login({ email, password });
    const { user, token } = res.data;
    setUser(user);
    setToken(token);
    localStorage.setItem('tc_token', token);
    localStorage.setItem('tc_user', JSON.stringify(user));
  };

  const register = async (data: any) => {
    const res = await authAPI.register(data);
    const { user, token } = res.data;
    setUser(user);
    setToken(token);
    localStorage.setItem('tc_token', token);
    localStorage.setItem('tc_user', JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
