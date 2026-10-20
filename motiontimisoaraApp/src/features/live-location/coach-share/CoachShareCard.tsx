import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  audienceText,
  consentText,
  formatClock,
  retentionText,
  windowText,
  type CoachShareView,
} from './types'

function line(view: CoachShareView) {
  const { sharing, occurrenceId, eligibleTime, camp } = view
  if (sharing.active) {
    const sent = sharing.active.lastSentAt
      ? `ultima poziție ${formatClock(sharing.active.lastSentAt, true)}`
      : 'așteptăm prima poziție'
    return `Transmiți până la ${formatClock(sharing.active.expiresAt)} · ${sent}`
  }
  if (!occurrenceId) return 'Alege o ședință ca să poți partaja locația.'
  if (!eligibleTime) return windowText(camp)
  return camp ? 'Disponibilă pentru tabăra aleasă.' : 'Disponibilă pentru ședința aleasă.'
}

export function CoachShareCard(view: CoachShareView) {
  const { sharing, occurrenceId, eligibleTime, checked, camp } = view
  const consentId = useId()
  const [open, setOpen] = useState(false)
  const active = !!sharing.active
  const canOffer = !active && !!occurrenceId && eligibleTime
  return (
    <section
      aria-label="Partajarea locației antrenorului"
      className={cn(
        'mb-6 space-y-3 rounded-2xl border p-4',
        active ? 'bg-success/10 border-success/30' : 'bg-card',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl',
              active ? 'bg-success/20 text-success-ink' : 'bg-primary/10 text-primary',
            )}
          >
            <MapPin aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">
              {active ? 'Locația ta este partajată' : 'Locația antrenorului'}
            </h2>
            <p className="text-muted-foreground text-sm" role="status">
              {line(view)}
            </p>
          </div>
        </div>
        {active && (
          <Button
            type="button"
            variant="outline"
            className="bg-background w-full sm:w-auto"
            disabled={sharing.stopping}
            onClick={view.onStop}
          >
            Oprește partajarea
          </Button>
        )}
        {canOffer && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={sharing.busy || sharing.needsStopRetry}
            onClick={() => setOpen(true)}
          >
            {sharing.busy ? 'Se pornește…' : 'Partajează locația'}
          </Button>
        )}
      </div>
      {active && sharing.active?.occurrenceId !== occurrenceId && (
        <p className="text-muted-foreground text-sm">
          Partajezi pentru o altă ședință sau tabără. Oprește partajarea înainte să alegi alta.
        </p>
      )}
      {view.error && (
        <p role="alert" className="text-destructive text-sm">
          {view.error}
        </p>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>
              {camp ? 'Partajezi locația pentru tabără?' : 'Partajezi locația pentru ședință?'}
            </SheetTitle>
            <SheetDescription>{audienceText(camp)}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 text-sm">
            <p className="text-muted-foreground">
              {retentionText}{' '}
              <Link to="/confidentialitate" className="text-primary underline">
                Detalii despre confidențialitate
              </Link>
            </p>
            <div className="flex items-start gap-3">
              <input
                id={consentId}
                type="checkbox"
                className="accent-primary mt-1 size-5 shrink-0"
                checked={checked}
                disabled={sharing.busy || sharing.needsStopRetry}
                onChange={(event) => view.onConsent(event.target.checked)}
              />
              <Label htmlFor={consentId} className="leading-6">
                {consentText(camp)}
              </Label>
            </div>
          </div>
          <SheetFooter className="sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button
              type="button"
              disabled={!checked || !eligibleTime || sharing.busy || sharing.needsStopRetry}
              onClick={() => {
                setOpen(false)
                view.onStart()
              }}
            >
              Pornește partajarea
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  )
}
