import type { UseFormRegisterReturn } from 'react-hook-form'

import type { AdminClub } from '@/api/admin'
import { Label } from '@/components/ui/label'
import { CourseOwnerField } from '@/features/club/course-form/CourseOwnerField'

export function ActivityOwnerFields({
  owner,
  clubs,
  locked,
  ownerError,
  coaches,
  coachField,
  coachError,
  noCoaches,
  noLocations,
  selectClassName,
  onOwner,
}: {
  owner: string
  clubs: AdminClub[]
  locked: boolean
  ownerError: string | null
  coaches: { user_id: string; name: string }[]
  coachField: UseFormRegisterReturn<'coach_id'>
  coachError?: string
  noCoaches: boolean
  noLocations: boolean
  selectClassName: string
  onOwner: (owner: string) => void
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <CourseOwnerField
          value={owner}
          clubs={clubs}
          locked={locked}
          error={ownerError}
          selectClassName={selectClassName}
          onChange={onOwner}
        />
        <div className="space-y-1.5">
          <Label htmlFor="coach_id">Antrenor</Label>
          <select
            id="coach_id"
            className={selectClassName}
            disabled={!owner}
            {...coachField}
            aria-invalid={!!coachError}
            aria-describedby={coachError ? 'coach_id-error' : undefined}
          >
            <option value="">{owner ? '—' : 'Alege întâi organizatorul'}</option>
            {coaches.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.name}
              </option>
            ))}
          </select>
          {coachError && (
            <p id="coach_id-error" className="text-destructive text-xs">
              {coachError}
            </p>
          )}
        </div>
      </div>
      {owner && (noCoaches || noLocations) && (
        <div className="bg-highlight/10 text-foreground/80 rounded-2xl border p-4 text-sm">
          {noCoaches && <p>Organizatorul ales nu are antrenori.</p>}
          {noLocations && <p>Organizatorul ales nu are locații active.</p>}
        </div>
      )}
    </>
  )
}
