import { httpClient } from './httpClient';
import { API_BASE_URL } from '../config/env';

export type AttachmentDto = {
  id: string;
  type: string;
  displayOrder: number;
  image: boolean;
  url: string | null;
};

export type AnnouncementDto = {
  id: string;
  courseId: string | null;
  courseName: string | null;
  content: string;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  authorRole: string;
  attachments: AttachmentDto[];
};

export const getParentAnnouncementsFeed = async (options?: {
  courseId?: string;
  limit?: number;
}): Promise<AnnouncementDto[]> => {
  const params: Record<string, string | number> = {};
  if (options?.courseId) params.courseId = options.courseId;
  if (options?.limit) params.limit = options.limit;
  const response = await httpClient.get<AnnouncementDto[]>('/api/parent/announcements', {
    params,
  });
  return response.data;
};

export const getParentCourseAnnouncements = async (
  courseId: string,
): Promise<AnnouncementDto[]> => {
  const response = await httpClient.get<AnnouncementDto[]>(
    `/api/parent/courses/${courseId}/announcements`,
  );
  return response.data;
};

export const buildParentAnnouncementImageUrl = (
  courseId: string,
  announcementId: string,
  imageId: string,
): string => {
  return `${API_BASE_URL}/api/parent/courses/${courseId}/announcements/${announcementId}/images/${imageId}`;
};

export const buildParentAnnouncementVideoUrl = (
  courseId: string,
  announcementId: string,
  videoId: string,
): string => {
  return `${API_BASE_URL}/api/parent/courses/${courseId}/announcements/${announcementId}/videos/${videoId}`;
};
