import { AdminSport } from './admin-sport.model';

export interface AdminClub {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  createdAt: string;
  active: boolean;
  hasLogo: boolean;
  coachCount: number;
  courseCount: number;
  stripeConnected: boolean;
}

export interface AdminClubDetail extends AdminClub {
  coaches: AdminClubCoach[];
  companyName: string | null;
  companyCui: string | null;
  companyRegNumber: string | null;
  companyAddress: string | null;
  bankAccount: string | null;
  bankName: string | null;
  sports: AdminSport[];
}

export interface AdminClubCoach {
  id: string;
  name: string;
  email: string;
}

export interface UpdateClubPayload {
  name?: string;
  email?: string;
  description?: string;
  phone?: string;
  address?: string;
  city?: string;
  website?: string;
  // Company Info
  companyName?: string;
  companyCui?: string;
  companyRegNumber?: string;
  companyAddress?: string;
  bankAccount?: string;
  bankName?: string;
}
