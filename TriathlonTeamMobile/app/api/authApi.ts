import { httpClient } from './httpClient';

export type BackendRole = string;

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: BackendRole;
  phone: string | null;
  oauthProvider: string | null;
  avatarUrl: string | null;
  needsProfileCompletion: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await httpClient.post<AuthResponse>('/api/auth/login', { email, password });
  return response.data;
};
