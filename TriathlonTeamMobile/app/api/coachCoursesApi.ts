import { httpClient } from './httpClient';

export type CoachCourseDto = {
  id: string;
  name: string;
  sport: string;
  level: string | null;
  active: boolean;
  description: string | null;
};

export const listCoachCourses = async (): Promise<CoachCourseDto[]> => {
  const response = await httpClient.get<CoachCourseDto[]>('/api/coach/courses');
  return response.data;
};

// Full course details for edit screen (mirrors CourseResponse in backend)
export type CoachCourseDetailDto = {
  id: string;
  name: string;
  sport: string;
  level: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  coachId: string;
  locationId: string;
  capacity: number | null;
  price: number;
  pricePerSession: number;
  packageOptions: string | null;
  recurrenceRule: string | null;
  active: boolean;
  description: string | null;
  hasHeroPhoto: boolean;
};

export type CoachCourseUpdateRequest = {
  name: string;
  sport: string;
  level: string | null;
  ageFrom: number | null;
  ageTo: number | null;
  coachId: string | null;
  locationId: string;
  capacity: number | null;
  price: number;
  pricePerSession: number;
  packageOptions: string | null;
  recurrenceRule: string;
  active: boolean;
  description: string | null;
  heroPhoto?: string | null;
};

export const getCoachCourse = async (
  courseId: string,
): Promise<CoachCourseDetailDto> => {
  const response = await httpClient.get<CoachCourseDetailDto>(
    `/api/coach/courses/${courseId}`,
  );
  return response.data;
};

export const updateCoachCourse = async (
  courseId: string,
  payload: CoachCourseUpdateRequest,
): Promise<CoachCourseDetailDto> => {
  const response = await httpClient.put<CoachCourseDetailDto>(
    `/api/coach/courses/${courseId}`,
    payload,
  );
  return response.data;
};

export const setCoachCourseStatus = async (
  courseId: string,
  active: boolean,
): Promise<void> => {
  await httpClient.patch(`/api/coach/courses/${courseId}/status`, { active });
};
