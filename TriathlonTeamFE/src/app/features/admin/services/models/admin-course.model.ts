import { CourseScheduleSlot } from '../../../coach/services/coach-api.service';
import { CourseFormPayload } from '../../../coach/services/coach.service';

export interface AdminCourse {
  id: string;
  name: string;
  coachName: string;
  sport: string;
  level?: string | null;
  location?: string | null;
  capacity?: number | null;
  active: boolean;
  enrolledCount: number;
  reservedCount: number;
  enrolledPaidCount?: number;
  enrolledUnpaidCount?: number;
  hasHeroPhoto: boolean;
}

export interface AdminCourseDetail {
  id: string;
  name: string;
  coachId: string;
  coachName: string;
  sport: string;
  level?: string | null;
  locationId: string;
  location?: string | null;
  capacity?: number | null;
  price: number;
  pricePerSession: number;
  packageOptions?: string | null;
  active: boolean;
  recurrenceRule?: string | null;
  ageFrom?: number | null;
  ageTo?: number | null;
  scheduleSlots?: CourseScheduleSlot[];
  hasHeroPhoto: boolean;
  description?: string | null;
}

export interface AdminCoursePayload {
  coachId: string;
  course: CourseFormPayload & { heroPhoto?: string };
  recurrenceRule?: string | null;
  active: boolean;
}

export interface CoursePhotoItem {
  id: string;
  displayOrder: number;
  url?: string;
}

