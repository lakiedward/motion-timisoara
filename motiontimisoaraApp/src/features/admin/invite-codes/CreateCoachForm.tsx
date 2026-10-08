import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'

import { createCoachAccount, getAllClubs, type CreatedCoach } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CopyInviteValueButton from './CopyInviteValueButton'

const selectClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50'

const coachSchema = z.object({
  firstName: z.string().trim().min(2, 'Minim 2 caractere'),
  lastName: z.string().trim().min(2, 'Minim 2 caractere'),
  email: z.string().trim().email('Email invalid'),
  phone: z.string().optional(),
  clubId: z.string().optional(),
})
type CoachValues = z.infer<typeof coachSchema>

export default function CreateCoachForm() {
  const pending = useRef(false)
  const toggleButton = useRef<HTMLButtonElement>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [created, setCreated] = useState<(CreatedCoach & { clubName: string | null }) | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<CoachValues>({
    resolver: zodResolver(coachSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', clubId: '' },
  })
  const clubs = useQuery({ queryKey: ['admin-clubs'], queryFn: getAllClubs, retry: false })

  const onCreateCoach = async (values: CoachValues) => {
    if (pending.current) return
    pending.current = true
    setIsCreating(true)
    setFailure(null)
    try {
      const result = await createCoachAccount({
        name: `${values.firstName} ${values.lastName}`,
        email: values.email,
        phone: values.phone || undefined,
        clubId: values.clubId || undefined,
      })
      const club = clubs.data?.find((item) => item.id === result.clubId)
      setCreated({ ...result, clubName: result.clubId ? (club?.name ?? 'clubul ales') : null })
      reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut crea antrenorul.'
      setFailure(message)
    } finally {
      pending.current = false
      setIsCreating(false)
    }
  }
  const onToggle = () => {
    if (pending.current) return
    setExpanded(!expanded)
    if (!expanded) requestAnimationFrame(() => setFocus('firstName'))
    else toggleButton.current?.focus()
  }

  return (
    <section aria-labelledby="direct-coach-heading">
      <Card>
        <CardHeader className="gap-3">
          <h2 id="direct-coach-heading" className="font-display text-xl font-bold text-foreground">
            Adaugă antrenor direct
          </h2>
          <p className="text-muted-foreground text-sm">
            Creezi un cont de antrenor, independent sau direct într-un club. Vei primi o parolă
            temporară de transmis antrenorului.
          </p>
          <div>
            <Button
              ref={toggleButton}
              type="button"
              variant="outline"
              className="min-h-11"
              aria-expanded={expanded}
              aria-controls="direct-coach-form"
              disabled={isCreating}
              onClick={onToggle}
            >
              <UserPlus /> {expanded ? 'Închide formularul' : 'Adaugă antrenor'}
            </Button>
          </div>
        </CardHeader>
        <CardContent hidden={!expanded && !created} className="space-y-4">
          {created && (
            <div className="bg-success/10 border-success/30 rounded-2xl border p-4">
              <p role="status" className="text-sm font-semibold">
                Antrenor creat.
              </p>
              <p className="break-all text-sm font-semibold">
                Ultimul antrenor creat: {created.email}
              </p>
              <p className="text-sm">
                {created.clubName
                  ? `Adăugat în clubul ${created.clubName}.`
                  : 'Antrenor independent, fără club.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Parolă temporară:</span>
                <code className="bg-muted break-all rounded px-2 py-1 font-mono text-sm">
                  {created.tempPassword}
                </code>
                <CopyInviteValueButton
                  key={created.tempPassword}
                  value={created.tempPassword}
                  label="Copiază parola temporară"
                  successMessage="Parolă copiată."
                />
              </div>
            </div>
          )}
          <form
            id="direct-coach-form"
            hidden={!expanded}
            onSubmit={(event) => void handleSubmit(onCreateCoach)(event)}
            className={expanded ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="coach-first-name">Prenume</Label>
              <Input
                id="coach-first-name"
                className="min-h-11"
                autoComplete="off"
                {...register('firstName')}
                disabled={isCreating}
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? 'coach-first-name-error' : undefined}
              />
              {errors.firstName && (
                <p id="coach-first-name-error" className="text-destructive text-xs">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-last-name">Nume</Label>
              <Input
                id="coach-last-name"
                className="min-h-11"
                autoComplete="off"
                {...register('lastName')}
                disabled={isCreating}
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? 'coach-last-name-error' : undefined}
              />
              {errors.lastName && (
                <p id="coach-last-name-error" className="text-destructive text-xs">
                  {errors.lastName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-email">Email</Label>
              <Input
                id="coach-email"
                type="email"
                className="min-h-11"
                {...register('email')}
                disabled={isCreating}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'coach-email-error' : undefined}
              />
              {errors.email && (
                <p id="coach-email-error" className="text-destructive text-xs">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-phone">Telefon (opțional)</Label>
              <Input
                id="coach-phone"
                className="min-h-11"
                {...register('phone')}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coach-club">Club (opțional)</Label>
              <select
                id="coach-club"
                className={selectClass}
                {...register('clubId')}
                disabled={isCreating}
                aria-describedby={clubs.isError ? 'coach-club-error' : undefined}
              >
                <option value="">Fără club — antrenor independent</option>
                {(clubs.data ?? []).map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.city ? `${club.name} (${club.city})` : club.name}
                  </option>
                ))}
              </select>
              {clubs.isPending && (
                <p className="text-muted-foreground text-xs">Se încarcă cluburile…</p>
              )}
              {clubs.isError && (
                <div id="coach-club-error" className="flex flex-wrap items-center gap-2">
                  <p className="text-destructive text-xs">
                    Lista cluburilor nu s-a încărcat. Poți crea un antrenor independent.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={clubs.isFetching}
                    onClick={() => void clubs.refetch()}
                  >
                    {clubs.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
                  </Button>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="min-h-11" disabled={isCreating}>
                <UserPlus /> {isCreating ? 'Se creează…' : 'Creează antrenor'}
              </Button>
            </div>
            {failure && (
              <p role="alert" className="text-destructive text-sm sm:col-span-2">
                {failure}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
