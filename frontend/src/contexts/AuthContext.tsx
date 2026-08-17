import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../api/client';
import type { User } from '../types';

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: getStoredToken(),
    isLoading: true,
  });

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setAuth({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setAuth({ user: response.data, token, isLoading: false });
    } catch {
      setStoredToken(null);
      setAuth({ user: null, token: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const nextToken = response.data.token;
    const nextUser = response.data.user;

    setStoredToken(nextToken);
    setAuth({ user: nextUser, token: nextToken, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      display_name: displayName,
    });

    const nextToken = response.data.token;
    const nextUser = response.data.user;

    setStoredToken(nextToken);
    setAuth({ user: nextUser, token: nextToken, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setAuth({ user: null, token: null, isLoading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      login,
      register,
      logout,
      refreshUser,
    }),
    [auth, login, logout, refreshUser, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
