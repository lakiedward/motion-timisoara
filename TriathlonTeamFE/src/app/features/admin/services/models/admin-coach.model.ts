import { Sport } from './sport.model';

export interface AdminCoachListItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  sports: Sport[];
  cities?: string[];
  courseCount: number;
  enabled: boolean;
  hasPhoto?: boolean;
}

export interface InviteCoachPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  bio?: string;
  sportIds?: string[];
  photo?: string;
}

export interface UpdateCoachPayload {
  name: string;
  email?: string;
  password?: string;
  phone?: string;
  bio?: string;
  sportIds?: string[];
  photo?: string;
}
