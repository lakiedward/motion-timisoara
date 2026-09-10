import { useQuery } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { ActiveLocationAnnouncements } from '@/features/live-location/camps/ActiveLocationAnnouncements'

import { getMyAnnouncements } from '@/api/account'
import { getAtasamente } from '@/api/attachments'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function AnnouncementsPage() {
  const {
    data: announcements = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-announcements'],
    queryFn: getMyAnnouncements,
    retry: false,
  })

  const idClub = announcements.filter((a) => a.sursa === 'club').map((a) => a.id)
  const { data: atasamente = {} } = useQuery({
    queryKey: ['my-announcement-media', idClub.join(',')],
    queryFn: () => getAtasamente(idClub),
    enabled: idClub.length > 0,
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Anunțuri</h1>
      <ActiveLocationAnnouncements />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : isError && !announcements.length ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca anunțurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : announcements.length ? (
        <ul className="space-y-4">
          {announcements.map((a) => (
            <li key={`${a.sursa}-${a.id}`} className="bg-card shadow-card rounded-3xl border p-5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {a.pinned && (
                  <span className="bg-highlight/15 text-highlight inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                    <Pin className="size-3" /> Fixat
                  </span>
                )}
                <span className="text-primary text-sm font-semibold">{a.autor}</span>
                <span className="text-muted-foreground text-xs">
                  {a.sursa === 'club' ? 'Anunț de club' : 'Anunț de la antrenor'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(a.created_at).toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {a.title && <h2 className="mb-1 font-semibold">{a.title}</h2>}
              <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{a.content}</p>
              {a.sursa === 'club' && <AnnouncementMedia atasamente={atasamente[a.id] ?? []} />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun mesaj încă. Aici apar anunțurile de la cursurile copiilor tăi și cele de la
          cluburile la care sunt înscriși.
        </div>
      )}
    </div>
  )
}
