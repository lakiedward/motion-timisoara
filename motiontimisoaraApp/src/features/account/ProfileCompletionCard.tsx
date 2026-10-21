import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ChevronRight, CircleAlert, Phone } from 'lucide-react'
import { toast } from 'sonner'

import { completeProfile } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/

export function ProfileCompletionCard() {
  const { user, refresh } = useAuth()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [invalid, setInvalid] = useState(false)
  const save = useMutation({
    mutationFn: async (value: string) => {
      if (!user) throw new Error('missing user')
      const { error } = await completeProfile(user.id, { name: user.name, phone: value })
      if (error) throw error
      await refresh()
    },
    onSuccess: () => {
      setOpen(false)
      toast.success('Profil actualizat')
    },
  })

  if (!user?.needsProfileCompletion) return null

  const openDialog = () => {
    save.reset()
    setInvalid(false)
    setOpen(true)
  }
  const submit = () => {
    const value = phone.replace(/\s+/g, '')
    if (!PHONE_PATTERN.test(value)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    save.mutate(value)
  }

  return (
    <section aria-labelledby="profile-completion-title">
      <div className="bg-card hover:border-primary/40 hover:bg-accent has-[:focus-visible]:outline-ring relative flex items-center gap-4 rounded-xl border p-6 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
        >
          <Phone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="profile-completion-title" className="font-display text-lg font-bold">
            Completează-ți profilul
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Adaugă un număr de telefon ca să te putem contacta despre înscrierile copiilor.
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          aria-haspopup="dialog"
          className="text-primary min-h-touch-target flex shrink-0 items-center gap-1 text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          <span className="sr-only sm:not-sr-only">Completează profilul</span>
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Adaugă numărul de telefon"
        description="Îl folosim ca să te putem contacta despre înscrierile copiilor."
        confirmLabel={save.isPending ? 'Se salvează…' : 'Salvează'}
        cancelLabel="Renunță"
        pending={save.isPending}
        onConfirm={submit}
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="space-y-3"
        >
          <Field
            id="profile-completion-phone"
            label="Telefon"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+40..."
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={invalid ? 'Număr de telefon invalid' : undefined}
            disabled={save.isPending}
          />
          {save.isError ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              Nu am putut salva numărul. Încearcă din nou.
            </p>
          ) : null}
        </form>
      </ConfirmDialog>
    </section>
  )
}
