import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'

import { createCoachAccount, type CreatedCoach } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CopyInviteValueButton from './CopyInviteValueButton'

const coachSchema = z.object({
  name: z.string().trim().min(2, 'Minim 2 caractere'),
  email: z.string().trim().email('Email invalid'),
  phone: z.string().optional(),
})
type CoachValues = z.infer<typeof coachSchema>

export default function CreateCoachForm() {
  const pending = useRef(false)
  const toggleButton = useRef<HTMLButtonElement>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [created, setCreated] = useState<CreatedCoach | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<CoachValues>({ resolver: zodResolver(coachSchema) })

  const onCreateCoach = async (values: CoachValues) => {
    if (pending.current) return
    pending.current = true
    setIsCreating(true)
    setFailure(null)
    try {
      const result = await createCoachAccount({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
      })
      setCreated(result)
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
    if (!expanded) requestAnimationFrame(() => setFocus('name'))
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
            Creezi un cont de antrenor independent (fără club). Vei primi o parolă temporară de
            transmis antrenorului.
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
              <Label htmlFor="coach-name">Nume</Label>
              <Input
                id="coach-name"
                className="min-h-11"
                {...register('name')}
                disabled={isCreating}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'coach-name-error' : undefined}
              />
              {errors.name && (
                <p id="coach-name-error" className="text-destructive text-xs">
                  {errors.name.message}
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
            <div className="flex items-end">
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
