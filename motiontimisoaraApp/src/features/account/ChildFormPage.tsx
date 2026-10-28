import { type ComponentProps, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, QrCode } from 'lucide-react'
import { toast } from 'sonner'

import { createChild, getChild, updateChild } from '@/api/account'
import { LeaveFormDialog } from '@/components/leave-form/LeaveFormDialog'
import { useLeaveGuard } from '@/components/leave-form/useLeaveGuard'
import { useAuth } from '@/lib/auth-context'
import { validReturnPath } from '@/lib/auth/return-path'
import { toIso } from '@/lib/camp-period'
import { formatLevel, toLevelSlug } from '@/lib/level'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-sm'

const TELEFON = /^\+?[0-9]{8,15}$/
const doarNumarul = (s: string) => s.replace(/[\s().-]/g, '')
const eTelefonValid = (s: string) => TELEFON.test(doarNumarul(s))
const azi = () => toIso(new Date())
const PICKUP_HINT = 'Nume și relație, câte unul pe rând. De exemplu: Maria Pop, bunica.'

const obligatoriu = (minim: number) =>
  z.string().trim().min(1, 'Obligatoriu').min(minim, `Minim ${minim} caractere`)

const schema = z.object({
  name: obligatoriu(2),
  birth_date: z
    .string()
    .min(1, 'Obligatoriu')
    .refine((s) => s <= azi(), 'Data nu poate fi în viitor'),
  level: z.string().optional(),
  allergies: z.string().optional(),
  medical_notes: z.string().max(1000, 'Maxim 1000 de caractere').optional(),
  dietary_restrictions: z.string().max(500, 'Maxim 500 de caractere').optional(),
  emergency_contact_name: obligatoriu(2),
  emergency_phone: z
    .string()
    .min(1, 'Obligatoriu')
    .refine(eTelefonValid, 'Număr de telefon invalid'),
  secondary_contact_name: z.string().optional(),
  secondary_phone: z
    .string()
    .optional()
    .refine((s) => !s || eTelefonValid(s), 'Număr de telefon invalid'),
  tshirt_size: z.string().optional(),
  swim_level: z.string().optional(),
  pickup_persons: z.string().max(500, 'Maxim 500 de caractere').optional(),
  photo_consent: z
    .string({ message: 'Alege una dintre variante' })
    .refine((s) => ['da', 'nu'].includes(s), 'Alege una dintre variante'),
})
type Values = z.infer<typeof schema>

function Obligatoriu() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ChildFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const idArataAUuid = !isEdit || UUID.test(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const bunVenit = !isEdit && params.get('bun-venit') === '1'
  const dupaSalvare = bunVenit
    ? validReturnPath(params.get('returnUrl')) || '/account'
    : '/account/children'
  const {
    data: existing,
    isPending: seIncarca,
    isError: aEsuatCitirea,
    refetch,
  } = useQuery({
    queryKey: ['child', id],
    queryFn: () => getChild(id as string),
    enabled: isEdit && idArataAUuid,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: bunVenit
      ? { emergency_contact_name: user?.name ?? '', emergency_phone: user?.phone ?? '' }
      : undefined,
  })

  const plecare = useLeaveGuard(isEdit && isDirty)

  const nivelSalvat = existing?.level ?? ''
  const nivelCunoscut = toLevelSlug(nivelSalvat)
  const nivelStrain = nivelSalvat && !nivelCunoscut ? nivelSalvat : ''

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        birth_date: existing.birth_date,
        level: toLevelSlug(existing.level) || existing.level || '',
        allergies: existing.allergies ?? '',
        medical_notes: existing.medical_notes ?? '',
        dietary_restrictions: existing.dietary_restrictions ?? '',
        emergency_contact_name: existing.emergency_contact_name ?? '',
        emergency_phone: existing.emergency_phone ?? '',
        secondary_contact_name: existing.secondary_contact_name ?? '',
        secondary_phone: existing.secondary_phone ?? '',
        tshirt_size: existing.tshirt_size ?? '',
        swim_level: existing.swim_level ?? '',
        pickup_persons: existing.pickup_persons ?? '',
        photo_consent:
          existing.photo_consent === true ? 'da' : existing.photo_consent === false ? 'nu' : '',
      })
    }
  }, [existing, reset])

  const onSubmit = async ({
    photo_consent,
    swim_level,
    pickup_persons,
    medical_notes,
    dietary_restrictions,
    ...v
  }: Values) => {
    const date = {
      ...v,
      medical_notes: medical_notes?.trim() || null,
      dietary_restrictions: dietary_restrictions?.trim() || null,
      swim_level: swim_level || null,
      pickup_persons: pickup_persons?.trim() || null,
      photo_consent: photo_consent === 'da',
    }
    try {
      if (isEdit) await updateChild(id as string, date)
      else await createChild(date)
      qc.invalidateQueries({ queryKey: ['children'] })
      toast.success(isEdit ? 'Copil actualizat.' : 'Copil adăugat.')
      plecare.allowLeave()
      navigate(dupaSalvare)
    } catch {
      toast.error('Nu am putut salva. Încearcă din nou.')
    }
  }

  if (isEdit && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <StatusView
          state="error"
          title="Nu am putut încărca copilul."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && (!idArataAUuid || (!seIncarca && !existing))) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <StatusView
          state="empty"
          title="Copilul nu a fost găsit."
          text="Poate a fost șters sau linkul nu mai este valabil."
          className="mt-4"
        />
      </div>
    )
  }

  if (isEdit && seIncarca) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <div role="status" aria-label="Se încarcă copilul" className="mt-4 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-touch-target w-32" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  const camp = (nume: keyof Values) => ({
    'aria-invalid': !!errors[nume],
    'aria-describedby': fieldDescription(nume, undefined, errors[nume]?.message),
  })

  return (
    <div className="mx-auto max-w-2xl">
      {!bunVenit && <InapoiLaCopii />}
      <div
        className={
          bunVenit
            ? 'flex flex-wrap items-center justify-between gap-3'
            : 'mt-4 flex flex-wrap items-center justify-between gap-3'
        }
      >
        <h1 className="font-display text-foreground text-2xl font-bold">
          {isEdit ? 'Editează copil' : bunVenit ? 'Adaugă-ți copilul' : 'Adaugă copil'}
        </h1>
        {isEdit && (
          <Button asChild variant="outline">
            <Link to={`/account/child/${id}/qr`}>
              <QrCode className="size-4" aria-hidden="true" /> Cod QR
            </Link>
          </Button>
        )}
      </div>
      {bunVenit && (
        <p className="text-muted-foreground mt-2">
          Contul tău e gata. Adaugă copilul ca să-l poți înscrie la cursuri, tabere și activități.
          Poți face asta și mai târziu, din Copiii mei.
        </p>
      )}
      <p className="text-muted-foreground mt-2 text-sm">
        Câmpurile marcate cu <span className="text-destructive">*</span> sunt obligatorii.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Despre copil</CardTitle>
            <CardDescription>Datele de bază, folosite la înscrieri și la tricou.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="name">
                  Nume <Obligatoriu />
                </Label>
                <Input id="name" required {...register('name')} {...camp('name')} />
                <FieldMessage id="name" error={errors.name?.message} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="birth_date">
                  Data nașterii <Obligatoriu />
                </Label>
                <Input
                  id="birth_date"
                  type="date"
                  max={azi()}
                  required
                  {...register('birth_date')}
                  {...camp('birth_date')}
                />
                <FieldMessage id="birth_date" error={errors.birth_date?.message} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="level">Nivel</Label>
                <select id="level" className={selectCls} {...register('level')}>
                  <option value="">—</option>
                  <option value="incepator">Începător</option>
                  <option value="intermediar">Intermediar</option>
                  <option value="avansat">Avansat</option>
                  {nivelStrain && <option value={nivelStrain}>{formatLevel(nivelStrain)}</option>}
                </select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="tshirt_size">Mărime tricou</Label>
                <select id="tshirt_size" className={selectCls} {...register('tshirt_size')}>
                  <option value="">—</option>
                  {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Sănătate</CardTitle>
            <CardDescription>Ce trebuie să știe antrenorul înainte de antrenament.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Alergii / observații</Label>
              <Textarea
                id="allergies"
                rows={4}
                className="max-h-64 [field-sizing:content]"
                aria-describedby="allergies-hint"
                {...register('allergies')}
              />
              <FieldMessage id="allergies" hint="Alergii și alte observații pentru antrenor." />
            </div>
            <TextLiber
              id="medical_notes"
              label="Afecțiuni și medicație"
              hint="De exemplu: astm, cu inhalatorul în rucsac."
              error={errors.medical_notes?.message}
              {...register('medical_notes')}
            />
            <TextLiber
              id="dietary_restrictions"
              label="Restricții alimentare"
              hint="De exemplu: vegetarian, fără lactoză."
              error={errors.dietary_restrictions?.message}
              {...register('dietary_restrictions')}
            />
            <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="swim_level">Știe să înoate?</Label>
              <select id="swim_level" className={selectCls} {...register('swim_level')}>
                <option value="">—</option>
                <option value="no">Nu</option>
                <option value="basic">Puțin</option>
                <option value="yes">Da</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Persoane de contact</CardTitle>
            <CardDescription>Pe cine sună antrenorul dacă se întâmplă ceva.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-sans text-sm font-semibold tracking-normal">Urgență</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="emergency_contact_name">
                  Contact urgență <Obligatoriu />
                </Label>
                <Input
                  id="emergency_contact_name"
                  required
                  autoComplete="name"
                  {...register('emergency_contact_name')}
                  {...camp('emergency_contact_name')}
                />
                <FieldMessage
                  id="emergency_contact_name"
                  error={errors.emergency_contact_name?.message}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="emergency_phone">
                  Telefon urgență <Obligatoriu />
                </Label>
                <Input
                  id="emergency_phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  {...register('emergency_phone')}
                  {...camp('emergency_phone')}
                />
                <FieldMessage id="emergency_phone" error={errors.emergency_phone?.message} />
              </div>
            </div>
            <h3 className="border-t pt-4 font-sans text-sm font-semibold tracking-normal">
              Secundar (opțional)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="secondary_contact_name">Contact secundar</Label>
                <Input id="secondary_contact_name" {...register('secondary_contact_name')} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="secondary_phone">Telefon secundar</Label>
                <Input
                  id="secondary_phone"
                  type="tel"
                  {...register('secondary_phone')}
                  {...camp('secondary_phone')}
                />
                <FieldMessage id="secondary_phone" error={errors.secondary_phone?.message} />
              </div>
            </div>
            <div className="border-t pt-4">
              <TextLiber
                id="pickup_persons"
                label="Cine poate ridica copilul"
                hint={PICKUP_HINT}
                error={errors.pickup_persons?.message}
                {...register('pickup_persons')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Acord foto și video</CardTitle>
            <CardDescription>
              Cluburile și antrenorii pot publica poze de la antrenamente și tabere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset
              aria-invalid={!!errors.photo_consent}
              aria-describedby={fieldDescription(
                'photo_consent',
                undefined,
                errors.photo_consent?.message,
              )}
            >
              <legend className="mb-2 text-sm font-medium">
                Copilul poate apărea în poze și video? <Obligatoriu />
              </legend>
              <div className="space-y-1">
                {(
                  [
                    ['da', 'Da, poate apărea'],
                    ['nu', 'Nu, fără poze și video cu copilul'],
                  ] as const
                ).map(([valoare, eticheta]) => (
                  <label key={valoare} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="radio"
                      value={valoare}
                      className="accent-primary size-4"
                      {...register('photo_consent')}
                    />
                    {eticheta}
                  </label>
                ))}
              </div>
              <FieldMessage id="photo_consent" error={errors.photo_consent?.message} />
            </fieldset>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" asChild>
            <Link to={bunVenit ? dupaSalvare : '/account/children'}>
              {bunVenit ? 'Mai târziu' : 'Anulează'}
            </Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} className="sm:min-w-40">
            {isSubmitting ? 'Se salvează…' : bunVenit ? 'Salvează copilul' : 'Salvează'}
          </Button>
        </div>
      </form>
      <LeaveFormDialog {...plecare.dialog} />
    </div>
  )
}

function TextLiber({
  id,
  label,
  hint,
  error,
  ...props
}: ComponentProps<'textarea'> & { id: string; label: string; hint: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={2}
        className="max-h-64 [field-sizing:content]"
        aria-invalid={!!error}
        aria-describedby={fieldDescription(id, hint, error)}
        {...props}
      />
      <FieldMessage id={id} hint={hint} error={error} />
    </div>
  )
}

function InapoiLaCopii() {
  return (
    <Link
      to="/account/children"
      className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> Înapoi
    </Link>
  )
}
