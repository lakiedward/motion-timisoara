import { useCallback, useEffect, useState } from 'react';
import type { AnnouncementDto } from '../../../../api/parentAnnouncementsApi';
import {
  createCoachAnnouncement,
  deleteCoachAnnouncement,
  listCoachCourseAnnouncements,
  setCoachAnnouncementPinned,
} from '../../../../api/coachAnnouncementsApi';

export const useCoachCourseAnnouncements = (courseId: string) => {
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCoachCourseAnnouncements(courseId);
      setItems(data);
    } catch (e) {
      setError('Nu s-au putut încărca anunțurile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (content: string, options?: { pinAfterPost?: boolean; videoUrl?: string }) => {
      const trimmedContent = content.trim();
      const trimmedVideo = options?.videoUrl?.trim();
      if (!trimmedContent && !trimmedVideo) {
        setError('Scrie un mesaj sau adaugă un link video.');
        return;
      }
      setSubmitting(true);
      try {
        await createCoachAnnouncement(courseId, {
          content: trimmedContent,
          pinAfterPost: options?.pinAfterPost,
          videoUrls: trimmedVideo ? [trimmedVideo] : undefined,
        });
        await load();
      } catch (e) {
        setError('Nu s-a putut crea anunțul. Încearcă din nou.');
      } finally {
        setSubmitting(false);
      }
    },
    [courseId, load],
  );

  const togglePinned = useCallback(
    async (announcementId: string, currentPinned: boolean) => {
      setSubmitting(true);
      try {
        await setCoachAnnouncementPinned(courseId, announcementId, !currentPinned);
        await load();
      } catch (e) {
        setError('Nu s-a putut actualiza starea de pin. Încearcă din nou.');
      } finally {
        setSubmitting(false);
      }
    },
    [courseId, load],
  );

  const remove = useCallback(
    async (announcementId: string) => {
      setSubmitting(true);
      try {
        await deleteCoachAnnouncement(courseId, announcementId);
        await load();
      } catch (e) {
        setError('Nu s-a putut șterge anunțul. Încearcă din nou.');
      } finally {
        setSubmitting(false);
      }
    },
    [courseId, load],
  );

  return { items, loading, error, submitting, reload: load, create, togglePinned, remove };
};
