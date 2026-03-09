export interface AdminActivity {
  id: string;
  name: string;
  coachName: string;
  sport: string;
  sportName: string;
  location: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number | null;
  active: boolean;
  enrolledCount: number;
  reservedCount: number;
  hasHeroPhoto: boolean;
}

export interface AdminActivityDetail {
  id: string;
  name: string;
  description: string | null;
  coachId: string;
  coachName: string;
  sport: string;
  sportName: string;
  locationId: string;
  locationName: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  capacity: number | null;
  active: boolean;
  hasHeroPhoto: boolean;
  createdAt: string;
}

export interface AdminActivityPayload {
  name: string;
  description?: string | null;
  coachId: string;
  sport: string;
  locationId: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  price: number;
  currency?: string;
  capacity?: number | null;
  active?: boolean;
}
