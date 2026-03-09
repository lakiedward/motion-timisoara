export type AdminLocationType = 'POOL' | 'TRACK' | 'GYM' | 'OTHER';

export interface AdminLocation {
  id: string;
  name: string;
  type: AdminLocationType;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface AdminLocationPayload {
  name: string;
  type: AdminLocationType;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

