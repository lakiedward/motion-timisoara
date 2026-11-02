import { RequiredMark } from '@/components/FormSection'
import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import type { AdminClub } from '@/api/admin'
import { SHARED_OWNER } from './useLocationFormOwner'

export function LocationOwnerField({
  value,
  clubs,
  coaches,
  locked,
  lockedName,
  error,
  onChange,
}: {
  value: string
  clubs: AdminClub[]
  coaches: { user_id: string; name: string }[]
  locked: boolean
  lockedName: string
  error: string | null
  onChange: (owner: string) => void
}) {
  const hintId = locked ? 'owner-hint' : error ? 'owner-error' : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor="owner">Organizator {!locked && <RequiredMark />}</Label>
      {locked ? (
        <SelectMenu
          id="owner"
          value={value}
          disabled
          onValueChange={onChange}
          aria-describedby={hintId}
          options={[{ value, label: value === SHARED_OWNER ? 'Fără organizator' : lockedName }]}
        />
      ) : (
        <SelectMenu
          id="owner"
          value={value}
          onValueChange={onChange}
          aria-invalid={!!error}
          aria-describedby={hintId}
          searchable
          emptyLabel="—"
          groups={[
            {
              label: 'Cluburi',
              options: clubs.map((c) => ({ value: `club:${c.id}`, label: c.name })),
            },
            {
              label: 'Antrenori',
              options: coaches.map((c) => ({ value: `coach:${c.user_id}`, label: c.name })),
            },
          ]}
        />
      )}
      {locked ? (
        <p id="owner-hint" className="text-muted-foreground text-xs">
          Organizatorul rămâne cel de la creare.
        </p>
      ) : (
        error && (
          <p id="owner-error" className="text-destructive text-xs">
            {error}
          </p>
        )
      )}
    </div>
  )
}
