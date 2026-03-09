import { httpClient } from './httpClient';
import { API_BASE_URL } from '../config/env';
import type { AnnouncementDto } from './parentAnnouncementsApi';

export type CoachCreateAnnouncementRequest = {
  content: string;
  images?: string[];
  videoUrls?: string[];
  pinAfterPost?: boolean;
};

export const listCoachCourseAnnouncements = async (
  courseId: string,
): Promise<AnnouncementDto[]> => {
  const response = await httpClient.get<AnnouncementDto[]>(
    `/api/coach/courses/${courseId}/announcements`,
  );
  return response.data;
};

export const createCoachAnnouncement = async (
  courseId: string,
  payload: CoachCreateAnnouncementRequest,
): Promise<AnnouncementDto> => {
  const response = await httpClient.post<AnnouncementDto>(
    `/api/coach/courses/${courseId}/announcements`,
    payload,
  );
  return response.data;
};

export const setCoachAnnouncementPinned = async (
  courseId: string,
  announcementId: string,
  pinned: boolean,
): Promise<void> => {
  await httpClient.patch(`/api/coach/courses/${courseId}/announcements/${announcementId}/pin`, {
    pinned,
  });
};

export const deleteCoachAnnouncement = async (
  courseId: string,
  announcementId: string,
): Promise<void> => {
  await httpClient.delete(`/api/coach/courses/${courseId}/announcements/${announcementId}`);
};

export const buildCoachAnnouncementImageUrl = (
  courseId: string,
  announcementId: string,
  imageId: string,
): string => {
  return `${API_BASE_URL}/api/coach/courses/${courseId}/announcements/${announcementId}/images/${imageId}`;
};

export const buildCoachAnnouncementVideoUrl = (
  courseId: string,
  announcementId: string,
  videoId: string,
): string => {
  return `${API_BASE_URL}/api/coach/courses/${courseId}/announcements/${announcementId}/videos/${videoId}`;
};
