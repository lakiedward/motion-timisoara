import { Label } from '@/components/ui/label'
import type { AdminClub } from '@/api/admin'
import { SHARED_OWNER } from './useLocationFormOwner'

export function LocationOwnerField({
  value,
  clubs,
  coaches,
  locked,
  lockedName,
  error,
  selectClassName,
  onChange,
}: {
  value: string
  clubs: AdminClub[]
  coaches: { user_id: string; name: string }[]
  locked: boolean
  lockedName: string
  error: string | null
  selectClassName: string
  onChange: (owner: string) => void
}) {
  const hintId = locked ? 'owner-hint' : error ? 'owner-error' : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor="owner">Organizator</Label>
      <select
        id="owner"
        className={selectClassName}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={hintId}
      >
        {locked ? (
          <option value={value}>{value === SHARED_OWNER ? 'Fără organizator' : lockedName}</option>
        ) : (
          <>
            <option value="">—</option>
            <optgroup label="Cluburi">
              {clubs.map((c) => (
                <option key={c.id} value={`club:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Antrenori">
              {coaches.map((c) => (
                <option key={c.user_id} value={`coach:${c.user_id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </>
        )}
      </select>
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
