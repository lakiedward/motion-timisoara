import type { CampParticipant } from '@/api/live-location/discovery'
import { campLocationKey } from '@/api/live-location/target'
import { Button } from '@/components/ui/button'
import { CoachLocationPanel } from '../CoachLocationPanel'

export function CampLocationShare({
  campId,
  actorId,
  canShare,
  startsAt,
  endsAt,
}: {
  campId: string
  actorId: string | null
  canShare: boolean
  startsAt?: string
  endsAt?: string
}) {
  if (!actorId || !canShare || !startsAt || !endsAt) return null
  return (
    <div className="my-6">
      <CoachLocationPanel
        occurrenceId={campLocationKey(campId, actorId)}
        startsAt={startsAt}
        endsAt={endsAt}
        context="camp"
      />
    </div>
  )
}

export function CampArrivalOnCard({
  nume,
  participant,
  pending,
  confirmingDeparture,
  onArrive,
  onAskDeparture,
  onDepart,
  onCancelDeparture,
}: {
  nume: string
  participant: CampParticipant | null
  pending: boolean
  confirmingDeparture: boolean
  onArrive: () => void
  onAskDeparture: () => void
  onDepart: () => void
  onCancelDeparture: () => void
}) {
  if (!participant) return null
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm" role="status">
          {participant.departedAt
            ? 'Plecat din tabără'
            : participant.arrivedAt
              ? 'Sosire confirmată'
              : 'Sosire neconfirmată'}
        </p>
        {!participant.departedAt && (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 lg:h-9 lg:min-h-9"
            disabled={pending}
            onClick={() => {
              if (participant.arrivedAt) onAskDeparture()
              else onArrive()
            }}
          >
            {participant.arrivedAt ? 'Confirmă plecarea' : 'Confirmă sosirea'}
          </Button>
        )}
      </div>
      {confirmingDeparture && !participant.departedAt && (
        <div className="bg-muted space-y-2 rounded-xl p-3">
          <p className="text-sm">
            Confirmi că {nume} a părăsit tabăra? Accesul la locație pentru acest copil se încheie.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11 min-h-11 lg:h-9 lg:min-h-9"
              disabled={pending}
              onClick={onDepart}
            >
              Da, a plecat
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 lg:h-9 lg:min-h-9"
              disabled={pending}
              onClick={onCancelDeparture}
            >
              Anulează
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
