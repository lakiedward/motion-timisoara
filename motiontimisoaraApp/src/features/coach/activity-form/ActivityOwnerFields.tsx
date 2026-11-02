import type { Control, FieldPath, FieldValues } from 'react-hook-form'

import type { AdminClub } from '@/api/admin'
import { FormSelectMenu } from '@/components/ui/form-select-menu'
import { Label } from '@/components/ui/label'
import { CourseOwnerField } from '@/features/club/course-form/CourseOwnerField'

export function ActivityOwnerFields<TValues extends FieldValues & { coach_id?: string }>({
  owner,
  clubs,
  locked,
  ownerError,
  coaches,
  control,
  coachError,
  noCoaches,
  noLocations,
  onOwner,
}: {
  owner: string
  clubs: AdminClub[]
  locked: boolean
  ownerError: string | null
  coaches: { user_id: string; name: string }[]
  control: Control<TValues>
  coachError?: string
  noCoaches: boolean
  noLocations: boolean
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
          onChange={onOwner}
        />
        <div className="space-y-1.5">
          <Label htmlFor="coach_id">Antrenor</Label>
          <FormSelectMenu
            control={control}
            name={'coach_id' as FieldPath<TValues>}
            id="coach_id"
            disabled={!owner}
            aria-invalid={!!coachError}
            aria-describedby={coachError ? 'coach_id-error' : undefined}
            searchable={coaches.length > 8}
            emptyLabel={owner ? '—' : 'Alege întâi organizatorul'}
            options={coaches.map((c) => ({ value: c.user_id, label: c.name }))}
          />
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
