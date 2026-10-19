import { useQuery } from '@tanstack/react-query'
import { getAtasamente } from '@/api/attachments'
import type { AnnouncementRow } from '@/api/announcements/parent'

export function useAnnouncementMedia(items: AnnouncementRow[], userId: string) {
  const clubIds = items.filter((item) => item.source === 'club').map((item) => item.id)
  const coachIds = items.filter((item) => item.source === 'coach').map((item) => item.id)
  return useQuery({
    queryKey: ['parent-announcement-media', userId, clubIds.join(','), coachIds.join(',')],
    queryFn: async () => {
      const [club, coach] = await Promise.all([
        getAtasamente(clubIds),
        getAtasamente(coachIds, 'coach'),
      ])
      return { club, coach }
    },
    enabled: items.length > 0,
    retry: false,
  })
}
