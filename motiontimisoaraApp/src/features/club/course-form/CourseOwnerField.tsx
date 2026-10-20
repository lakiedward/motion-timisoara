import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/FormSection'
import type { AdminClub } from '@/api/admin'
import { INDEPENDENT_OWNER } from './useCourseFormOwner'

export function CourseOwnerField({
  value,
  clubs,
  locked,
  error,
  selectClassName,
  required = false,
  onChange,
}: {
  value: string
  clubs: AdminClub[]
  locked: boolean
  error: string | null
  selectClassName: string
  required?: boolean
  onChange: (owner: string) => void
}) {
  const hintId = locked ? 'owner-hint' : error ? 'owner-error' : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor="owner">Organizator {required && <RequiredMark />}</Label>
      <select
        id="owner"
        className={selectClassName}
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={hintId}
      >
        <option value="">—</option>
        <option value={INDEPENDENT_OWNER}>Antrenor independent</option>
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
      {locked ? (
        <p id="owner-hint" className="text-muted-foreground text-xs">
          Organizatorul rămâne cel de la creare. Poți schimba antrenorul.
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
