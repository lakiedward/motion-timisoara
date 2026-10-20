import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  Eye,
  EyeOff,
  Images,
  Pin,
  PinOff,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'

import { getAtasamente } from '@/api/attachments'
import type { AdminAnnouncement } from '@/api/announcements/admin-announcements'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { PRIORITY, formatData } from '@/features/club/announcements/announcement-list'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { announcementLabel } from './announcement-overview'

export function AdminAnnouncementItem({
  announcement: a,
  query,
  pending,
  onToggle,
  onDelete,
}: {
  announcement: AdminAnnouncement
  query: string
  pending: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const media = useQuery({
    queryKey: ['admin-announcement-media', a.source, a.id],
    queryFn: () => getAtasamente([a.id], a.source),
    enabled: open && a.mediaCount > 0,
  })
  const priority = a.priority && a.priority !== 'NORMAL' ? (PRIORITY[a.priority] ?? null) : null
  const label = announcementLabel(a)
  const expandable = a.mediaCount > 0 || a.content.length > 140 || a.content.includes('\n')

  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5',
        !a.visible && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 text-base font-bold wrap-anywhere">
            <Highlight text={label} query={query} />
          </h3>
          <Badge variant="outline">{a.source === 'club' ? 'De la club' : 'De la antrenor'}</Badge>
          {priority && <Badge variant={priority.variant}>{priority.label}</Badge>}
          {a.pinned && (
            <Badge variant="highlight">
              <Pin aria-hidden="true" /> Fixat
            </Badge>
          )}
          {!a.visible && (
            <Badge variant="outline">
              <EyeOff aria-hidden="true" /> Ascuns
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {a.title && (
            <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
              <Users aria-hidden="true" className="size-4 shrink-0" />
              <Highlight text={a.audience} query={query} />
            </span>
          )}
          {a.coachName && a.organizerKind === 'club' && (
            <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
              <UserRound aria-hidden="true" className="size-4 shrink-0" />
              <Highlight text={a.coachName} query={query} />
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            <time dateTime={a.createdAt}>{formatData(a.createdAt)}</time>
          </span>
        </p>
        <p
          className={cn(
            'text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere',
            !open && 'line-clamp-2',
          )}
        >
          <Highlight text={a.content} query={query} />
        </p>
        {open && a.mediaCount === 0 ? null : open ? (
          media.isError ? (
            <StatusView
              state="error"
              title="Nu am putut încărca pozele."
              onRetry={() => media.refetch()}
            />
          ) : (
            <AnnouncementMedia atasamente={media.data?.[a.id] ?? []} />
          )
        ) : expandable ? (
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-touch-target p-0 has-[>svg]:px-0 lg:min-h-8"
            aria-expanded={false}
            onClick={() => setOpen(true)}
          >
            {a.mediaCount > 0 && <Images aria-hidden="true" />}
            {a.mediaCount > 0
              ? `Vezi tot și ${plural(a.mediaCount, 'atașament', 'atașamente')}`
              : 'Vezi tot'}
          </Button>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 lg:h-9"
          disabled={pending}
          aria-label={`${toggleText(a)} anunțul „${label}”`}
          onClick={onToggle}
        >
          {toggleIcon(a)}
          {toggleText(a)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive h-11 lg:h-9"
          disabled={pending}
          aria-label={`Șterge anunțul „${label}”`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" /> Șterge
        </Button>
      </div>
    </li>
  )
}

function toggleText(a: AdminAnnouncement) {
  if (a.source === 'club') return a.visible ? 'Ascunde de părinți' : 'Arată părinților'
  return a.pinned ? 'Desprinde' : 'Fixează sus'
}

function toggleIcon(a: AdminAnnouncement) {
  if (a.source === 'club')
    return a.visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />
  return a.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />
}
