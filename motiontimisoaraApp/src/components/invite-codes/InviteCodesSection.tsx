import { useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'

import { inviteCodeStatus } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import CopyInviteValueButton from './CopyInviteValueButton'

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

export type InviteCodeRow = {
  id: string
  code: string
  current_uses: number
  max_uses: number
  expires_at: string | null
}

export type InviteCodesSource = {
  queryKey: readonly unknown[]
  enabled?: boolean
  load: () => Promise<InviteCodeRow[]>
  generate: (maxUses: number, expiresAt: string | null) => Promise<string>
  remove: (id: string) => Promise<void>
}

export default function InviteCodesSection({
  source,
  title,
  description,
}: {
  source: InviteCodesSource
  title: string
  description: string
}) {
  const qc = useQueryClient()
  const generationPending = useRef(false)
  const deletionPending = useRef(false)
  const toggleButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [generated, setGenerated] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const query = useQuery({
    queryKey: source.queryKey,
    queryFn: source.load,
    enabled: source.enabled ?? true,
  })
  const codes = query.data ?? []
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { maxUses: '1', expiresAt: '' },
  })
  const gen = useMutation({
    mutationFn: (values: InviteValues) =>
      source.generate(
        Number(values.maxUses),
        values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      ),
    onSuccess: (code) => {
      setGenerated(code)
      void qc.invalidateQueries({ queryKey: source.queryKey })
    },
  })
  const del = useMutation({
    mutationFn: source.remove,
    onSuccess: (_result, id) => {
      if (codes.find((code) => code.id === id)?.code === generated) setGenerated(null)
      void qc.invalidateQueries({ queryKey: source.queryKey })
      setDeleted(true)
    },
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
    setDeleted(false)
    try {
      await del.mutateAsync(id)
    } catch {
      return
    } finally {
      deletionPending.current = false
    }
  }
  const onToggle = () => {
    if (generationPending.current) return
    setExpanded(!expanded)
    if (!expanded) requestAnimationFrame(() => setFocus('maxUses'))
    else toggleButton.current?.focus()
  }

  return (
    <section aria-labelledby="invite-codes-heading">
      <Card>
        <CardHeader className="gap-3">
          <h2 id="invite-codes-heading" className="font-display text-xl font-bold text-foreground">
            {title}
          </h2>
          <p className="text-muted-foreground text-sm">{description}</p>
          <div>
            <Button
              ref={toggleButton}
              type="button"
              variant={expanded ? 'outline' : 'default'}
              className="min-h-11"
              aria-expanded={expanded}
              aria-controls="invite-code-form"
              disabled={gen.isPending || source.enabled === false}
              onClick={onToggle}
            >
              <Plus /> {expanded ? 'Închide setările' : 'Cod nou'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            id="invite-code-form"
            hidden={!expanded}
            className={expanded ? 'space-y-3 rounded-xl border bg-muted/30 p-4' : 'hidden'}
          >
            <h3 className="font-display font-semibold">Setări pentru codul nou</h3>
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
                    errors.expiresAt
                      ? 'invite-expires-zone invite-expires-error'
                      : 'invite-expires-zone'
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
                  Nu am putut genera un cod nou. Încearcă din nou.
                </p>
              )}
            </form>
          </div>
          {generated && (
            <div className="bg-success/10 border-success/30 space-y-3 rounded-2xl border p-3">
              <p role="status" className="text-sm font-semibold">
                Cod generat.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Cod nou:</span>
                <code className="bg-muted break-all rounded px-2 py-1 font-mono text-sm">
                  {generated}
                </code>
                <CopyInviteValueButton
                  key={generated}
                  autoCopy
                  value={generated}
                  label="Copiază codul nou"
                  successMessage="Codul nou a fost copiat."
                />
              </div>
            </div>
          )}
          {deleted && (
            <p role="status" className="text-muted-foreground text-sm">
              Cod șters.
            </p>
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
                              : 'Activ'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">
                        Utilizări: {code.current_uses}/{code.max_uses}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {expires
                          ? `${status === 'expired' ? 'Expirat' : 'Expiră'} pe ${expires} (${timezone})`
                          : 'Fără expirare'}
                      </p>
                    </div>
                    <div className="flex min-w-0 items-start gap-1">
                      <CopyInviteValueButton
                        key={code.code}
                        value={code.code}
                        label={`Copiază codul invitație ${index + 1}`}
                        successMessage="Codul existent a fost copiat."
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
        </CardContent>
      </Card>
    </section>
  )
}
