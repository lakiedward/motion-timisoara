import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'

import { createManagedCoach, type CreateManagedCoachResult } from '@/api/club'
import { RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import CopyInviteValueButton from '@/components/invite-codes/CopyInviteValueButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CopyAccountDetailsButton from './CopyAccountDetailsButton'

const coachSchema = z.object({
  firstName: z.string().trim().min(2, 'Minim 2 caractere'),
  lastName: z.string().trim().min(2, 'Minim 2 caractere'),
  email: z.string().trim().email('Email invalid'),
  phone: z.string().optional(),
})
type CoachValues = z.infer<typeof coachSchema>

function accountDetailsText(created: CreateManagedCoachResult) {
  return `Email: ${created.email}\nParolă temporară: ${created.tempPassword}`
}

export default function ClubCoachForm({ clubId }: { clubId: string | undefined }) {
  const qc = useQueryClient()
  const pending = useRef(false)
  const toggleButton = useRef<HTMLButtonElement>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [created, setCreated] = useState<CreateManagedCoachResult | null>(null)
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
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  })

  const onCreateCoach = async (values: CoachValues) => {
    if (pending.current) return
    pending.current = true
    setIsCreating(true)
    setFailure(null)
    try {
      const result = await createManagedCoach({
        name: `${values.firstName} ${values.lastName}`,
        email: values.email,
        phone: values.phone || undefined,
      })
      setCreated(result)
      reset()
      void qc.invalidateQueries({ queryKey: ['club-coaches', clubId] })
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Nu am putut crea antrenorul.')
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

  const field = (name: keyof CoachValues, label: string, type = 'text', required = true) => {
    const id = `coach-${name}`
    const message = errors[name]?.message
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {label} {required && <RequiredMark />}
        </Label>
        <Input
          id={id}
          type={type}
          className="min-h-11"
          autoComplete="off"
          {...register(name)}
          disabled={isCreating}
          aria-invalid={!!message}
          aria-describedby={message ? `${id}-error` : undefined}
        />
        {message && (
          <p id={`${id}-error`} className="text-destructive text-xs">
            {message}
          </p>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby="club-direct-coach-heading">
      <Card>
        <CardHeader className="gap-3">
          <h2
            id="club-direct-coach-heading"
            className="font-display text-xl font-bold text-foreground"
          >
            Adaugă antrenor direct
          </h2>
          <p className="text-muted-foreground text-sm">
            Creezi un cont de antrenor adăugat automat în club. Vei primi o parolă temporară de
            transmis antrenorului.
          </p>
          <div>
            <Button
              ref={toggleButton}
              type="button"
              variant="outline"
              className="min-h-11"
              aria-expanded={expanded}
              aria-controls="club-direct-coach-form"
              disabled={isCreating || !clubId}
              onClick={onToggle}
            >
              <UserPlus /> {expanded ? 'Închide formularul' : 'Adaugă antrenor'}
            </Button>
          </div>
        </CardHeader>
        <CardContent hidden={!expanded && !created} className="space-y-4">
          {created && (
            <div className="bg-success/10 border-success/30 rounded-2xl border p-4">
              <p role="status" className="break-all text-sm font-semibold">
                Antrenor creat: {created.email}
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
                  successMessage="Parola temporară a fost copiată."
                />
              </div>
              <div className="mt-3">
                <CopyAccountDetailsButton
                  key={created.tempPassword}
                  value={accountDetailsText(created)}
                />
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Transmite aceste date antrenorului. Îi recomandăm să schimbe parola la prima
                autentificare.
              </p>
            </div>
          )}
          <form
            id="club-direct-coach-form"
            hidden={!expanded}
            onSubmit={(event) => void handleSubmit(onCreateCoach)(event)}
            className={expanded ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}
            noValidate
          >
            {field('firstName', 'Prenume')}
            {field('lastName', 'Nume')}
            {field('email', 'Email', 'email')}
            {field('phone', 'Telefon (opțional)', 'tel', false)}
            <div className="sm:col-span-2">
              <Button type="submit" className="min-h-11" disabled={isCreating || !clubId}>
                <UserPlus /> {isCreating ? 'Se creează…' : 'Creează antrenor'}
              </Button>
              <RequiredFieldsNote />
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
