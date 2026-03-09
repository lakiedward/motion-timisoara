import { supabase } from '../lib/supabase';

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

const mapAttachments = (
  attachments: Array<{
    id: string;
    file_name: string;
    storage_path: string;
    content_type: string | null;
    display_order?: number;
  }>,
): AttachmentDto[] => {
  return attachments.map((att, index) => {
    const isImage = att.content_type?.startsWith('image/') ?? false;
    const { data } = supabase.storage
      .from('announcement-attachments')
      .getPublicUrl(att.storage_path);

    return {
      id: att.id,
      type: att.content_type ?? 'application/octet-stream',
      displayOrder: att.display_order ?? index,
      image: isImage,
      url: data.publicUrl,
    };
  });
};

export const getParentAnnouncementsFeed = async (options?: {
  courseId?: string;
  limit?: number;
}): Promise<AnnouncementDto[]> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Get child IDs to find enrolled course IDs
  const { data: children } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', user.user.id);

  if (!children || children.length === 0) return [];

  const childIds = children.map((c) => c.id);

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('entity_id, entity_type')
    .in('child_id', childIds)
    .eq('entity_type', 'COURSE')
    .eq('status', 'ACTIVE');

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.entity_id))];
  if (courseIds.length === 0 && !options?.courseId) return [];

  const targetCourseIds = options?.courseId ? [options.courseId] : courseIds;

  let query = supabase
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
    .in('course_id', targetCourseIds)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
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
      attachments: mapAttachments(attachments),
    };
  });
};

export const getParentCourseAnnouncements = async (
  courseId: string,
): Promise<AnnouncementDto[]> => {
  return getParentAnnouncementsFeed({ courseId });
};

export const buildParentAnnouncementImageUrl = (
  _courseId: string,
  _announcementId: string,
  storagePath: string,
): string => {
  const { data } = supabase.storage
    .from('announcement-attachments')
    .getPublicUrl(storagePath);
  return data.publicUrl;
};

export const buildParentAnnouncementVideoUrl = (
  _courseId: string,
  _announcementId: string,
  storagePath: string,
): string => {
  const { data } = supabase.storage
    .from('announcement-attachments')
    .getPublicUrl(storagePath);
  return data.publicUrl;
};
