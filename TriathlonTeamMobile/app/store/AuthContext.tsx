import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as loginApi } from '../api/authApi';
import { setHttpAccessToken } from '../api/httpClient';

export type AuthUser = {
  id: string | null;
  name: string | null;
  email: string | null;
};

export type Role = 'PARENT' | 'COACH' | 'ADMIN';

export type AuthContextValue = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  roles: Role[];
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginMock: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const auth = await loginApi(email, password);

    setAccessToken(auth.accessToken);
    setRefreshToken(auth.refreshToken);
    setHttpAccessToken(auth.accessToken);

    const userSummary = auth.user;
    setUser({ id: userSummary.id, name: userSummary.name, email: userSummary.email });
    setRoles([userSummary.role as Role]);
    setIsAuthenticated(true);

    try {
      await SecureStore.setItemAsync('accessToken', auth.accessToken);
      await SecureStore.setItemAsync('refreshToken', auth.refreshToken);
    } catch {
      // Stocarea token-urilor poate eșua pe unele dispozitive; nu blocăm login-ul pentru asta.
    }
  };

  const loginMock = () => {
    setUser({ id: '1', name: 'Mock Parent', email: 'parent@example.com' });
    setRoles(['PARENT']);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setRoles([]);
    setAccessToken(null);
    setRefreshToken(null);
    setHttpAccessToken(null);
    try {
      SecureStore.deleteItemAsync('accessToken');
      SecureStore.deleteItemAsync('refreshToken');
    } catch {
      // Ignorăm erorile de ștergere a token-urilor din storage.
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, roles, accessToken, refreshToken, login, loginMock, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
