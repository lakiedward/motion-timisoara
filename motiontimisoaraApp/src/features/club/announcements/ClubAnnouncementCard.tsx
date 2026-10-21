import { CalendarDays, CalendarX, Clock, Eye, EyeOff, Pencil, Trash2, Users } from 'lucide-react'
import type { ClubAnnouncement } from '@/api/club'
import type { AtasamentAfisabil } from '@/api/attachments'
import AnnouncementMedia from '@/components/AnnouncementMedia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AnnouncementEditForm } from './AnnouncementEditForm'
import { formatData, priorityOf } from './announcement-list'
import { formatMoment, scheduleState } from './announcement-schedule'

type Props = {
  anunt: ClubAnnouncement
  tinta: string
  atasamente: AtasamentAfisabil[]
  seAscunde: boolean
  seSterge: boolean
  editezAici: boolean
  onEdit: () => void
  onEditDone: (saved: boolean) => void
  onToggle: () => void
  onDelete: () => void
}

export function ClubAnnouncementCard({
  anunt: a,
  tinta,
  atasamente,
  seAscunde,
  seSterge,
  editezAici,
  onEdit,
  onEditDone,
  onToggle,
  onDelete,
}: Props) {
  const p = priorityOf(a)
  const stare = scheduleState(a)
  if (editezAici) {
    return (
      <article className="bg-card min-w-0 space-y-4 rounded-xl border p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Editezi anunțul</h3>
        <AnnouncementEditForm
          anunt={a}
          onSaved={() => onEditDone(true)}
          onCancel={() => onEditDone(false)}
        />
      </article>
    )
  }
  return (
    <article
      className={cn(
        'bg-card min-w-0 space-y-3 rounded-xl border p-5 sm:p-6',
        (!a.is_active || stare === 'expired') && 'bg-muted/40 border-dashed',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display min-w-0 text-lg font-bold wrap-anywhere">{a.title}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Badge variant={p.variant}>{p.label}</Badge>
          {stare === 'scheduled' && (
            <Badge variant="outline">
              <Clock aria-hidden="true" /> Programat
            </Badge>
          )}
          {stare === 'expired' && (
            <Badge variant="outline">
              <CalendarX aria-hidden="true" /> Expirat
            </Badge>
          )}
          {!a.is_active && (
            <Badge variant="outline">
              <EyeOff aria-hidden="true" /> Ascuns
            </Badge>
          )}
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          <Users aria-hidden="true" className="size-4 shrink-0" />
          <span className="wrap-anywhere">Trimis către: {tinta}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <time dateTime={a.created_at}>{formatData(a.created_at)}</time>
        </span>
        {stare === 'scheduled' && a.publish_at && (
          <span className="flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Apare pe <time dateTime={a.publish_at}>{formatMoment(a.publish_at)}</time>
            </span>
          </span>
        )}
        {a.expires_at && (
          <span className="flex items-center gap-1.5">
            <CalendarX aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {stare === 'expired' ? 'A expirat pe' : 'Expiră pe'}{' '}
              <time dateTime={a.expires_at}>{formatMoment(a.expires_at)}</time>
            </span>
          </span>
        )}
      </div>
      <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap wrap-anywhere">
        {a.content}
      </p>
      <AnnouncementMedia atasamente={atasamente} />
      {!a.is_active ? (
        <p className="text-muted-foreground text-sm">
          Părinții nu mai văd acest anunț. „Arată părinților” îl pune la loc.
        </p>
      ) : stare === 'expired' ? (
        <p className="text-muted-foreground text-sm">
          Părinții nu mai văd acest anunț. Din „Editează” poți alege o expirare nouă.
        </p>
      ) : stare === 'scheduled' ? (
        <p className="text-muted-foreground text-sm">
          Părinții încă nu văd anunțul. Notificarea pleacă la data publicării.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 lg:h-9"
          aria-label={`Editează anunțul „${a.title}”`}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" /> Editează
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 lg:h-9"
          disabled={seAscunde}
          aria-label={`${a.is_active ? 'Ascunde de părinți' : 'Arată părinților'} anunțul „${a.title}”`}
          onClick={onToggle}
        >
          {a.is_active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {a.is_active ? 'Ascunde de părinți' : 'Arată părinților'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive h-11 lg:h-9"
          disabled={seSterge}
          aria-label={`Șterge anunțul „${a.title}”`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" /> Șterge
        </Button>
      </div>
    </article>
  )
}
