import { httpClient } from './httpClient';

export type AdminCourseDto = {
  id: string;
  name: string;
  coachName: string;
  sport: string;
  level: string | null;
  location: string | null;
  capacity: number | null;
  active: boolean;
  enrolledCount: number;
  reservedCount: number;
  enrolledPaidCount: number;
  enrolledUnpaidCount: number;
  hasHeroPhoto: boolean;
};

export const listAdminCourses = async (): Promise<AdminCourseDto[]> => {
  const response = await httpClient.get<AdminCourseDto[]>('/api/admin/courses');
  return response.data;
};
