import { supabase } from '../lib/supabase';

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
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.session || !authData.user) {
    throw new Error(authError?.message ?? 'Login failed');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, name, phone, role, avatar_url')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? 'Failed to load user profile');
  }

  return {
    accessToken: authData.session.access_token,
    refreshToken: authData.session.refresh_token,
    user: {
      id: profile.id,
      name: profile.name ?? '',
      email: profile.email ?? authData.user.email ?? '',
      role: profile.role ?? 'PARENT',
      phone: profile.phone ?? null,
      oauthProvider: authData.user.app_metadata?.provider ?? null,
      avatarUrl: profile.avatar_url ?? null,
      needsProfileCompletion: !profile.name,
    },
  };
};
