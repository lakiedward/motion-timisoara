import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { useLiveLocationSharing } from './live-location-context'

export function CoachLocationPanel({
  occurrenceId,
  startsAt,
  endsAt,
  context = 'course',
}: {
  occurrenceId: string | null
  startsAt?: string
  endsAt?: string
  context?: 'course' | 'camp'
}) {
  const { user } = useAuth()
  const sharing = useLiveLocationSharing()
  const consentId = useId()
  const [consentedFor, setConsentedFor] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  if (user?.role !== 'COACH') return null
  const camp = context === 'camp'
  const eligibleTime =
    !!startsAt &&
    !!endsAt &&
    now >= Date.parse(startsAt) &&
    now < Date.parse(endsAt) + (camp ? 0 : 15 * 60_000)
  const checked = occurrenceId !== null && consentedFor === occurrenceId
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Nu am putut actualiza partajarea.')
    }
  }
  return (
    <section
      aria-label="Partajarea locației antrenorului"
      className="bg-card mb-6 space-y-3 rounded-2xl border p-4"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="size-5" /> Locația antrenorului
      </h2>
      {sharing.active ? (
        <>
          <p className="text-sm" role="status">
            Partajarea este activă până la{' '}
            {new Date(sharing.active.expiresAt).toLocaleTimeString('ro-RO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
          <p className="text-muted-foreground text-sm">
            {sharing.active.lastSentAt
              ? `Ultima poziție trimisă: ${new Date(sharing.active.lastSentAt).toLocaleTimeString('ro-RO')}.`
              : 'Așteptăm prima poziție de la dispozitiv.'}
          </p>
          {sharing.active.occurrenceId !== occurrenceId && (
            <p className="text-muted-foreground text-sm">
              Partajezi pentru o altă ședință sau tabără. Oprește partajarea înainte să alegi alta.
            </p>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={sharing.stopping}
            onClick={() => void run(sharing.stop)}
          >
            Oprește partajarea
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {camp
              ? 'Clubul organizator și părinții cu un copil înscris activ, cu sosirea confirmată și fără plecare înregistrată, pot vedea locația ta după ce își dau acordul. Partajarea apare în Anunțuri și poate continua în fundal. Se oprește automat după 8 ore sau la încheierea taberei, dacă aceasta se termină mai devreme.'
              : 'Clubul organizator și părinții care își dau acordul și au un copil înscris, prezent prin cod QR la această ședință, pot vedea locația ta. Partajarea continuă în fundal pe dispozitivele compatibile și se oprește cel târziu la 15 minute după încheierea ședinței.'}
          </p>
          <p className="text-muted-foreground text-sm">
            Poți opri oricând. Se păstrează doar ultima poziție, care este ștearsă la oprire sau
            expirare.{' '}
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
              disabled={!eligibleTime || sharing.busy || sharing.needsStopRetry}
              onChange={(event) => setConsentedFor(event.target.checked ? occurrenceId : null)}
            />
            <Label htmlFor={consentId} className="leading-6">
              {camp
                ? 'Sunt de acord să partajez locația mea pentru această tabără.'
                : 'Sunt de acord să partajez locația mea pentru această ședință.'}
            </Label>
          </div>
          {!eligibleTime && (
            <p className="text-muted-foreground text-sm">
              {camp
                ? 'Partajarea este disponibilă numai în perioada taberei.'
                : 'Partajarea este disponibilă numai în timpul ședinței și încă 15 minute după încheiere.'}
            </p>
          )}
          <Button
            type="button"
            disabled={!checked || !eligibleTime || sharing.busy || sharing.needsStopRetry}
            onClick={() => {
              if (!occurrenceId) return
              setConsentedFor(null)
              void run(() => sharing.start(occurrenceId))
            }}
          >
            {sharing.busy ? 'Se pornește…' : 'Pornește partajarea'}
          </Button>
        </>
      )}
      {(actionError || sharing.error) && (
        <p role="alert" className="text-destructive text-sm">
          {actionError || sharing.error}
        </p>
      )}
    </section>
  )
}
