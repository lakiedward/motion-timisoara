import { Link } from 'react-router-dom'
import { CircleAlert, Clock, LocateFixed, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { LiveLocationMap } from './LiveLocationMap'
import { useCoachLocation } from './use-coach-location'

export function LocationViewer({
  occurrenceId,
  className,
}: {
  occurrenceId: string
  className?: string
}) {
  const { user, parent, camp, current, metadata, refresh, consent } = useCoachLocation(occurrenceId)
  if (!user || !['PARENT', 'CLUB', 'COACH'].includes(user.role)) return null
  const until = metadata
    ? new Date(metadata.expiresAt).toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  return (
    <section aria-label="Locația antrenorului" className={cn('space-y-4', className)}>
      <h3 className="sr-only">Locația antrenorului</h3>
      {current?.loading && !metadata && <Skeleton className="h-24 rounded-xl" />}
      {current?.error && (
        <div
          role="alert"
          className="bg-destructive/10 flex flex-col gap-3 rounded-lg p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-destructive flex items-start gap-2 font-medium">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {current.error}
          </p>
          <Button
            type="button"
            variant="outline"
            className="bg-background shrink-0"
            disabled={current.busy}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" />
            Reîncearcă
          </Button>
        </div>
      )}
      {metadata && (
        <>
          {current?.point && !current.error && (
            <div className="space-y-2">
              <LiveLocationMap point={current.point} />
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-foreground flex items-center gap-1.5 font-medium">
                  <Clock aria-hidden="true" className="text-muted-foreground size-4" />
                  Actualizată la {new Date(current.point.capturedAt).toLocaleTimeString('ro-RO')}
                </span>
                <span>Precizie aproximativă {Math.round(current.point.accuracy)} m</span>
              </p>
            </div>
          )}
          {!current?.point && !current?.error && (!parent || metadata.consentGranted) && (
            <p
              role="status"
              className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg p-4 text-sm"
            >
              <LocateFixed aria-hidden="true" className="size-4 shrink-0" />
              Așteptăm o poziție actuală a antrenorului.
            </p>
          )}
          {parent && !metadata.consentGranted && (
            <p className="text-sm">
              {camp
                ? 'Poți vedea locația antrenorului dacă propriul copil este înscris activ în tabără, cu sosirea confirmată și fără plecare înregistrată.'
                : 'Poți vedea locația antrenorului doar pentru ședința la care copilul tău este înscris și prezent prin QR.'}{' '}
              <span className="text-muted-foreground">
                Acordul este valabil pentru această partajare și poate fi retras oricând.
              </span>
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Partajare activă până la {until}.{' '}
              {parent && (
                <Link to="/confidentialitate" className="text-primary font-medium underline">
                  Confidențialitate
                </Link>
              )}
            </p>
            {parent && (
              <Button
                type="button"
                variant={metadata.consentGranted ? 'outline' : 'default'}
                className="w-full shrink-0 sm:w-auto"
                disabled={current?.busy}
                onClick={() => void consent(!metadata.consentGranted)}
              >
                {metadata.consentGranted ? 'Retrage acordul' : 'Accept și văd locația'}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
