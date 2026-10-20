import { useState } from 'react'
import { Building2, CalendarDays, GraduationCap, Images, Pin, PinOff, Trash2 } from 'lucide-react'

import type { AtasamentAfisabil } from '@/api/attachments'
import type { CoachAnnouncement } from '@/api/coach-announcements'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PRIORITY, formatData } from '@/features/club/announcements/announcement-list'

type Props = {
  announcement: CoachAnnouncement
  courseName: string
  attachments: AtasamentAfisabil[]
  busy: boolean
  onTogglePin: () => void
  onDelete: () => void
}

export function CoachAnnouncementCard({
  announcement: a,
  courseName,
  attachments,
  busy,
  onTogglePin,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const fromClub = a.source === 'club'
  const priority = a.priority ? (PRIORITY[a.priority] ?? PRIORITY.NORMAL) : null
  const label = a.title ?? courseName
  return (
    <article className="bg-card min-w-0 space-y-3 rounded-xl border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display min-w-0 text-lg font-bold wrap-anywhere">{label}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {fromClub && <Badge variant="outline">De la club</Badge>}
          {fromClub && priority && a.priority !== 'NORMAL' && (
            <Badge variant={priority.variant}>{priority.label}</Badge>
          )}
          {a.pinned && (
            <Badge variant="highlight">
              <Pin aria-hidden="true" /> Fixat
            </Badge>
          )}
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {a.title && (
          <span className="flex min-w-0 items-center gap-1.5">
            <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
            <span className="wrap-anywhere">{courseName}</span>
          </span>
        )}
        {fromClub && a.clubName && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Building2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="wrap-anywhere">{a.clubName}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <time dateTime={a.createdAt}>{formatData(a.createdAt)}</time>
        </span>
      </div>
      <p
        className={cn(
          'text-foreground/90 leading-relaxed whitespace-pre-wrap wrap-anywhere',
          !open && 'line-clamp-2',
        )}
      >
        {a.content}
      </p>
      {open ? (
        <AnnouncementMedia atasamente={attachments} />
      ) : attachments.length > 0 || a.content.length > 120 ? (
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-11 p-0"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          {attachments.length > 0 && <Images aria-hidden="true" />}
          {attachments.length > 0 ? `Vezi tot și ${attachments.length} atașamente` : 'Vezi tot'}
        </Button>
      ) : null}
      {fromClub ? (
        <p className="text-muted-foreground border-t pt-3 text-sm">
          Trimis de club către părinții cursului. Doar clubul îl poate modifica.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 lg:h-9"
            disabled={busy}
            aria-label={`${a.pinned ? 'Desprinde' : 'Fixează sus'} anunțul din ${courseName}`}
            onClick={onTogglePin}
          >
            {a.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            {a.pinned ? 'Desprinde' : 'Fixează sus'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive h-11 lg:h-9"
            disabled={busy}
            aria-label={`Șterge anunțul din ${courseName}`}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" /> Șterge
          </Button>
        </div>
      )}
    </article>
  )
}
