import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyCoachClubs, joinClubByInvitation } from '@/api/coach-registration/club-membership'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const CODE_HINT_ID = 'club-code-hint'
const CODE_ERROR_ID = 'club-code-error'

export default function CoachClubsSection() {
  const qc = useQueryClient()
  const clubs = useQuery({ queryKey: ['my-coach-clubs'], queryFn: getMyCoachClubs })
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length < 5 || trimmed.length > 128) {
      setError('Introdu codul primit de la club, de exemplu ABCD-2345.')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await joinClubByInvitation(trimmed)
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setCode('')
    toast.success(
      result.alreadyMember
        ? `Faci deja parte din ${result.clubName}.`
        : `Te-ai alăturat clubului ${result.clubName}.`,
    )
    await qc.invalidateQueries({ queryKey: ['my-coach-clubs'] })
  }

  return (
    <section
      aria-labelledby="coach-clubs-heading"
      className="bg-card shadow-card space-y-4 rounded-3xl border p-6"
    >
      <h2 id="coach-clubs-heading" className="font-display text-lg font-bold text-foreground">
        Cluburile mele
      </h2>
      {clubs.isLoading ? (
        <Skeleton className="h-10 rounded-xl" />
      ) : clubs.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-sm">Nu am putut încărca cluburile.</p>
          <Button type="button" variant="outline" onClick={() => void clubs.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : clubs.data?.length ? (
        <ul className="space-y-2">
          {clubs.data.map((club) => (
            <li key={club.id} className="rounded-xl border px-4 py-3 text-sm text-foreground">
              {club.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nu faci parte din niciun club încă. Introdu codul primit de la club ca să te alături.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-1.5" noValidate>
        <Label htmlFor="club-code">Cod de club</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="club-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            aria-invalid={!!error}
            aria-describedby={error ? CODE_ERROR_ID : CODE_HINT_ID}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Se verifică…' : 'Alătură-te clubului'}
          </Button>
        </div>
        {error ? (
          <p id={CODE_ERROR_ID} className="text-destructive text-xs">
            {error}
          </p>
        ) : (
          <p id={CODE_HINT_ID} className="text-muted-foreground text-xs">
            Codul îl generează clubul din pagina Antrenori.
          </p>
        )}
      </form>
    </section>
  )
}
