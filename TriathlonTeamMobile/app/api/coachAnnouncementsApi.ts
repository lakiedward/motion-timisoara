import { supabase } from '../lib/supabase';
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
  const { data, error } = await supabase
    .from('course_announcements')
    .select(`
      id,
      course_id,
      title,
      body,
      pinned,
      created_at,
      author_id,
      courses (name),
      profiles:author_id (name, role),
      announcement_attachments (id, file_name, storage_path, content_type, display_order)
    `)
    .eq('course_id', courseId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const attachments = Array.isArray(row.announcement_attachments)
      ? row.announcement_attachments
      : [];

    return {
      id: row.id,
      courseId: row.course_id,
      courseName: course?.name ?? null,
      content: row.body ?? row.title ?? '',
      pinned: row.pinned ?? false,
      createdAt: row.created_at ?? '',
      authorName: author?.name ?? '',
      authorRole: author?.role ?? '',
      attachments: attachments.map((att, index) => {
        const isImage = att.content_type?.startsWith('image/') ?? false;
        const { data: urlData } = supabase.storage
          .from('announcement-attachments')
          .getPublicUrl(att.storage_path);

        return {
          id: att.id,
          type: att.content_type ?? 'application/octet-stream',
          displayOrder: att.display_order ?? index,
          image: isImage,
          url: urlData.publicUrl,
        };
      }),
    };
  });
};

export const createCoachAnnouncement = async (
  courseId: string,
  payload: CoachCreateAnnouncementRequest,
): Promise<AnnouncementDto> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Insert announcement
  const { data: announcement, error } = await supabase
    .from('course_announcements')
    .insert({
      course_id: courseId,
      title: '',
      body: payload.content,
      pinned: payload.pinAfterPost ?? false,
      author_id: user.user.id,
    })
    .select('id, course_id, title, body, pinned, created_at, author_id')
    .single();

  if (error || !announcement) throw new Error(error?.message ?? 'Failed to create announcement');

  // Get author info
  const { data: author } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.user.id)
    .single();

  // Get course name
  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .single();

  return {
    id: announcement.id,
    courseId: announcement.course_id,
    courseName: course?.name ?? null,
    content: announcement.body ?? announcement.title ?? '',
    pinned: announcement.pinned ?? false,
    createdAt: announcement.created_at ?? '',
    authorName: author?.name ?? '',
    authorRole: author?.role ?? '',
    attachments: [],
  };
};

export const setCoachAnnouncementPinned = async (
  _courseId: string,
  announcementId: string,
  pinned: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from('course_announcements')
    .update({ pinned })
    .eq('id', announcementId);

  if (error) throw new Error(error.message);
};

export const deleteCoachAnnouncement = async (
  _courseId: string,
  announcementId: string,
): Promise<void> => {
  // Delete attachments first
  await supabase
    .from('announcement_attachments')
    .delete()
    .eq('announcement_id', announcementId);

  const { error } = await supabase
    .from('course_announcements')
    .delete()
    .eq('id', announcementId);

  if (error) throw new Error(error.message);
};

export const buildCoachAnnouncementImageUrl = (
  _courseId: string,
  _announcementId: string,
  storagePath: string,
): string => {
  const { data } = supabase.storage
    .from('announcement-attachments')
    .getPublicUrl(storagePath);
  return data.publicUrl;
};

export const buildCoachAnnouncementVideoUrl = (
  _courseId: string,
  _announcementId: string,
  storagePath: string,
): string => {
  const { data } = supabase.storage
    .from('announcement-attachments')
    .getPublicUrl(storagePath);
  return data.publicUrl;
};
