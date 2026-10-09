import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { createManagedCoach, type CreateManagedCoachResult } from '@/api/club'
import CopyInviteValueButton from '@/components/invite-codes/CopyInviteValueButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const coachSchema = z.object({
  firstName: z.string().trim().min(2, 'Minim 2 caractere'),
  lastName: z.string().trim().min(2, 'Minim 2 caractere'),
  email: z.string().trim().email('Email invalid'),
  phone: z.string().optional(),
})
type CoachValues = z.infer<typeof coachSchema>

export default function ClubCoachForm({ clubId }: { clubId: string | undefined }) {
  const qc = useQueryClient()
  const [created, setCreated] = useState<CreateManagedCoachResult | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CoachValues>({
    resolver: zodResolver(coachSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  })

  const onCreateCoach = async (v: CoachValues) => {
    try {
      const result = await createManagedCoach({
        name: `${v.firstName} ${v.lastName}`,
        email: v.email,
        phone: v.phone || undefined,
      })
      setCreated(result)
      reset()
      void qc.invalidateQueries({ queryKey: ['club-coaches', clubId] })
      toast.success('Antrenor creat.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut crea antrenorul.')
    }
  }

  const field = (name: keyof CoachValues, label: string, type = 'text') => {
    const id = `coach-${name}`
    const message = errors[name]?.message
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          className="min-h-11"
          {...register(name)}
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
      <h2
        id="club-direct-coach-heading"
        className="font-display mb-4 text-xl font-bold text-foreground"
      >
        Adaugă antrenor direct
      </h2>
      <p className="text-muted-foreground mb-3 text-sm">
        Creezi un cont de antrenor adăugat automat în club. Vei primi o parolă temporară de transmis
        antrenorului.
      </p>

      {created && (
        <div className="bg-success/10 border-success/30 mb-4 rounded-2xl border p-4">
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
          <p className="text-muted-foreground mt-2 text-xs">
            Transmite aceste date antrenorului. Îi recomandăm să schimbe parola la prima
            autentificare.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onCreateCoach)} className="grid gap-3 sm:grid-cols-2" noValidate>
        {field('firstName', 'Prenume')}
        {field('lastName', 'Nume')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Telefon (opțional)', 'tel')}
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={isSubmitting || !clubId}>
            <UserPlus /> {isSubmitting ? 'Se creează…' : 'Creează antrenor'}
          </Button>
        </div>
      </form>
    </section>
  )
}
