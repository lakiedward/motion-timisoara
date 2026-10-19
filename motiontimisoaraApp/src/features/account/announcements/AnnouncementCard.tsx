import { Link } from 'react-router-dom'
import { CalendarDays, Pin, UserRound } from 'lucide-react'
import type { AnnouncementRow } from '@/api/announcements/parent'
import type { AtasamentAfisabil } from '@/api/attachments'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { audienceText, courseLabel, publishedDate, sourceLabel } from './announcement-display'

type CardProps = {
  item: AnnouncementRow
  attachments: AtasamentAfisabil[]
  fresh: boolean
}

const LINK =
  'text-primary focus-visible:outline-ring rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 wrap-anywhere'

function Badges({ item, fresh }: { item: AnnouncementRow; fresh: boolean }) {
  if (!fresh && !item.pinned) return null
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      {fresh && <Badge>Nou</Badge>}
      {item.pinned && (
        <Badge variant="highlight">
          <Pin aria-hidden="true" /> Fixat
        </Badge>
      )}
    </div>
  )
}

function Body({ item, attachments }: { item: AnnouncementRow; attachments: AtasamentAfisabil[] }) {
  return (
    <>
      {item.title && <p className="font-semibold wrap-anywhere">{item.title}</p>}
      <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap wrap-anywhere">
        {item.content}
      </p>
      <AnnouncementMedia atasamente={attachments} />
    </>
  )
}

export function AnnouncementCard({ item, attachments, fresh }: CardProps) {
  return (
    <article
      className={cn(
        'bg-card min-w-0 space-y-3 rounded-xl border p-5 sm:p-6',
        fresh && 'border-primary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display min-w-0 text-lg font-bold">
          {item.courseId ? (
            <Link to={`/cursuri/${item.courseId}`} className={LINK}>
              {courseLabel(item)}
            </Link>
          ) : (
            <span className="wrap-anywhere">{audienceText(item)}</span>
          )}
        </h3>
        <Badges item={item} fresh={fresh} />
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-foreground flex min-w-0 items-center gap-1.5 font-medium">
          <UserRound aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span className="wrap-anywhere">{item.authorName}</span>
          <span aria-hidden="true" className="text-muted-foreground font-normal">
            ·
          </span>
          <span className="text-muted-foreground font-normal">{sourceLabel(item)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <time dateTime={item.publishedAt}>{publishedDate(item)}</time>
        </span>
      </div>
      <Body item={item} attachments={attachments} />
    </article>
  )
}
