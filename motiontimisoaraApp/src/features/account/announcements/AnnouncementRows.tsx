import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Pin } from 'lucide-react'
import { getAtasamente } from '@/api/attachments'
import type { AnnouncementRow } from '@/api/announcements/parent'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function AnnouncementRows({
  items,
  userId,
  previousSeenAt,
}: {
  items: AnnouncementRow[]
  userId: string
  previousSeenAt: string | null
}) {
  const clubIds = items.filter((item) => item.source === 'club').map((item) => item.id)
  const coachIds = items.filter((item) => item.source === 'coach').map((item) => item.id)
  const media = useQuery({
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

  return (
    <Fragment>
      {items.map((item) => (
        <li
          key={`${item.source}-${item.id}`}
          className="bg-card shadow-card min-w-0 rounded-3xl border p-5"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {(!previousSeenAt || Date.parse(item.publishedAt) > Date.parse(previousSeenAt)) && (
              <Badge variant="default">Nou</Badge>
            )}
            {item.pinned && (
              <Badge variant="highlight">
                <Pin className="size-3" /> Fixat
              </Badge>
            )}
            <span className="text-foreground text-sm font-semibold wrap-anywhere">
              {item.authorName}
            </span>
            <span className="text-muted-foreground text-xs">
              {item.source === 'club' ? 'Anunț de club' : 'Anunț de la antrenor'}
            </span>
            <time dateTime={item.publishedAt} className="text-muted-foreground text-xs">
              {new Date(item.publishedAt).toLocaleDateString('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
          {item.courseId ? (
            <Link
              to={`/cursuri/${item.courseId}`}
              className="text-primary focus-visible:ring-ring mb-2 inline-flex min-h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 wrap-anywhere"
            >
              {item.courseName ?? item.audienceName ?? 'Vezi cursul'}
            </Link>
          ) : (
            <p className="text-muted-foreground mb-2 text-sm wrap-anywhere">
              {item.audienceKind === 'CAMP' ? 'Tabără: ' : ''}
              {item.audienceKind === 'ACTIVITY' ? 'Activitate: ' : ''}
              {item.audienceName ??
                (item.audienceKind === 'CLUB'
                  ? 'Toți părinții clubului'
                  : 'Destinație indisponibilă')}
            </p>
          )}
          {item.title && <h2 className="mb-1 font-semibold wrap-anywhere">{item.title}</h2>}
          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed wrap-anywhere">
            {item.content}
          </p>
          <AnnouncementMedia atasamente={media.data?.[item.source][item.id] ?? []} />
        </li>
      ))}
      {media.isPending && items.length > 0 && (
        <li className="text-muted-foreground text-sm" role="status">
          Se încarcă atașamentele…
        </li>
      )}
      {media.isError && (
        <li className="bg-card rounded-2xl border p-4" role="alert">
          <p className="text-sm">Nu am putut încărca atașamentele acestor anunțuri.</p>
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => void media.refetch()}
            disabled={media.isFetching}
          >
            Reîncearcă atașamentele
          </Button>
        </li>
      )}
    </Fragment>
  )
}
