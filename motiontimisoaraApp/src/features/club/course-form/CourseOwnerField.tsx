import { Label } from '@/components/ui/label'
import { SelectMenu } from '@/components/ui/select-menu'
import { RequiredMark } from '@/components/FormSection'
import type { AdminClub } from '@/api/admin'
import { INDEPENDENT_OWNER } from './useCourseFormOwner'

export function CourseOwnerField({
  value,
  clubs,
  locked,
  error,
  required = false,
  onChange,
}: {
  value: string
  clubs: AdminClub[]
  locked: boolean
  error: string | null
  required?: boolean
  onChange: (owner: string) => void
}) {
  const hintId = locked ? 'owner-hint' : error ? 'owner-error' : undefined
  return (
    <div className="space-y-1.5">
      <Label htmlFor="owner">Organizator {required && <RequiredMark />}</Label>
      <SelectMenu
        id="owner"
        value={value}
        disabled={locked}
        onValueChange={onChange}
        aria-invalid={!!error}
        aria-describedby={hintId}
        searchable={clubs.length > 8}
        emptyLabel="—"
        options={[
          { value: INDEPENDENT_OWNER, label: 'Antrenor independent' },
          ...clubs.map((club) => ({ value: club.id, label: club.name })),
        ]}
      />
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
