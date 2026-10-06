import { useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteInviteCode,
  generateCoachInviteCode,
  getCoachInviteCodes,
  inviteCodeStatus,
} from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import CopyInviteValueButton from './CopyInviteValueButton'
import { copyInviteValue } from './copyInviteValue'

const inviteSchema = z.object({
  maxUses: z.string().refine((value) => {
    const number = Number(value)
    return Number.isInteger(number) && number > 0 && number <= 2147483647
  }, 'Introdu un număr întreg între 1 și 2147483647.'),
  expiresAt: z
    .string()
    .refine(
      (value) => !value || new Date(value).getTime() > Date.now(),
      'Alege o dată și o oră în viitor.',
    ),
})
type InviteValues = z.infer<typeof inviteSchema>

export default function InviteCodesSection() {
  const qc = useQueryClient()
  const generationPending = useRef(false)
  const deletionPending = useRef(false)
  const [generated, setGenerated] = useState<string | null>(null)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = useQuery({ queryKey: ['invite-codes'], queryFn: getCoachInviteCodes })
  const codes = query.data ?? []
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { maxUses: '1', expiresAt: '' },
  })
  const gen = useMutation({
    mutationFn: (values: InviteValues) =>
      generateCoachInviteCode(
        Number(values.maxUses),
        values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      ),
    onSuccess: async (code) => {
      setGenerated(code)
      void qc.invalidateQueries({ queryKey: ['invite-codes'] })
      toast.success('Cod generat.')
      await copyInviteValue(code, 'Cod generat copiat.')
    },
    onError: () => toast.error('Nu am putut genera codul. Încearcă din nou.'),
  })
  const del = useMutation({
    mutationFn: deleteInviteCode,
    onSuccess: (_result, id) => {
      if (codes.find((code) => code.id === id)?.code === generated) setGenerated(null)
      void qc.invalidateQueries({ queryKey: ['invite-codes'] })
      toast.success('Cod șters.')
    },
    onError: () => toast.error('Nu am putut șterge codul. Codul rămâne în listă.'),
  })
  const onGenerate = async (values: InviteValues) => {
    if (generationPending.current) return
    generationPending.current = true
    try {
      await gen.mutateAsync(values)
    } catch {
      return
    } finally {
      generationPending.current = false
    }
  }
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const expiryInput = event.currentTarget.elements.namedItem('expiresAt')
    if (expiryInput instanceof HTMLInputElement && expiryInput.validity.badInput) {
      event.preventDefault()
      setError('expiresAt', {
        type: 'manual',
        message: 'Completează data și ora expirării sau golește câmpul.',
      })
      return
    }
    void handleSubmit(onGenerate)(event)
  }
  const onDelete = async (id: string) => {
    if (deletionPending.current) return
    deletionPending.current = true
    try {
      await del.mutateAsync(id)
    } catch {
      return
    } finally {
      deletionPending.current = false
    }
  }

  return (
    <section aria-labelledby="invite-codes-heading" className="space-y-4">
      <h2 id="invite-codes-heading" className="font-display text-xl font-bold text-foreground">
        Coduri invitație
      </h2>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="invite-max-uses">Număr maxim de utilizări</Label>
          <Input
            id="invite-max-uses"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            className="min-h-11"
            {...register('maxUses')}
            disabled={gen.isPending}
            aria-invalid={!!errors.maxUses}
            aria-describedby={errors.maxUses ? 'invite-max-uses-error' : undefined}
          />
          {errors.maxUses && (
            <p id="invite-max-uses-error" className="text-destructive text-xs">
              {errors.maxUses.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-expires">Expiră la (opțional)</Label>
          <Input
            id="invite-expires"
            type="datetime-local"
            className="min-h-11"
            {...register('expiresAt')}
            disabled={gen.isPending}
            aria-invalid={!!errors.expiresAt}
            aria-describedby={
              errors.expiresAt ? 'invite-expires-zone invite-expires-error' : 'invite-expires-zone'
            }
          />
          <p id="invite-expires-zone" className="text-muted-foreground text-xs">
            Fus local: {timezone}. Lasă gol pentru un cod fără expirare.
          </p>
          {errors.expiresAt && (
            <p id="invite-expires-error" className="text-destructive text-xs">
              {errors.expiresAt.message}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={gen.isPending}>
            <Plus /> {gen.isPending ? 'Se generează…' : 'Generează cod'}
          </Button>
        </div>
        {gen.isError && (
          <p role="alert" className="text-destructive text-sm sm:col-span-2">
            Nu am putut genera codul. Încearcă din nou.
          </p>
        )}
      </form>
      {generated && (
        <div
          role="status"
          className="bg-success/10 border-success/30 flex flex-wrap items-center gap-2 rounded-2xl border p-3"
        >
          <span className="text-sm">Cod nou:</span>
          <code className="bg-muted break-all rounded px-2 py-1 font-mono text-sm">
            {generated}
          </code>
          <CopyInviteValueButton
            value={generated}
            label="Copiază codul nou"
            successMessage="Cod copiat."
          />
        </div>
      )}
      {del.isError && (
        <p role="alert" className="text-destructive text-sm">
          Nu am putut șterge codul. Codul rămâne în listă.
        </p>
      )}
      {query.isPending ? (
        <div role="status" aria-label="Se încarcă codurile">
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 rounded-2xl border p-4">
          <p className="text-destructive text-sm">Nu am putut încărca codurile.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
          </Button>
        </div>
      ) : codes.length ? (
        <ul className="space-y-2">
          {codes.map((code, index) => {
            const status = inviteCodeStatus(code)
            const expires = code.expires_at
              ? new Intl.DateTimeFormat('ro-RO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(code.expires_at))
              : null
            return (
              <li
                key={code.id}
                className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="bg-muted break-all rounded px-2 py-1 font-mono text-sm">
                      {code.code}
                    </code>
                    <Badge variant={status === 'active' ? 'success' : 'outline'}>
                      {status === 'used'
                        ? 'Folosit'
                        : status === 'expired'
                          ? 'Expirat'
                          : `Activ · ${code.current_uses}/${code.max_uses}`}
                    </Badge>
                  </div>
                  {expires && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {status === 'expired' ? 'Expirat' : 'Expiră'} pe {expires} ({timezone})
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <CopyInviteValueButton
                    value={code.code}
                    label={`Copiază codul invitație ${index + 1}`}
                    successMessage="Cod copiat."
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive min-h-11 min-w-11"
                    aria-label={
                      del.isPending && del.variables === code.id
                        ? `Se șterge codul invitație ${index + 1}`
                        : `Șterge codul invitație ${index + 1}`
                    }
                    disabled={del.isPending}
                    onClick={() => void onDelete(code.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun cod. Generează unul pentru a invita un antrenor.
        </div>
      )}
    </section>
  )
}
