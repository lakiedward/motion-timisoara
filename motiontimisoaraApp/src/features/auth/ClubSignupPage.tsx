import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { AuthLayout } from './AuthLayout'
import { StepDots, SportPicker } from './wizard-bits'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchSports } from '@/api/sports'
import { registerClub, roleHome } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  email: z.string().email('Email invalid'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')
    .optional()
    .or(z.literal('')),
  password: z.string().min(6, 'Minim 6 caractere'),
  clubName: z.string().min(2, 'Minim 2 caractere'),
  clubDescription: z.string().optional(),
  clubCity: z.string().optional(),
  clubEmail: z.string().email('Email invalid').optional().or(z.literal('')),
  clubPhone: z.string().optional(),
  // Billing identity. `clubs` has carried these columns since the first
  // migration and register-club has always written them, but no screen ever
  // asked for them, so every club existed without anything to invoice against.
  companyName: z.string().min(3, 'Minim 3 caractere'),
  companyCui: z
    .string()
    .trim()
    .regex(/^(RO)?\d{2,10}$/i, 'CUI invalid (ex. RO12345678)'),
  // Un club sportiv din România e de obicei „Asociație Club Sportiv”: persoană
  // juridică fără scop patrimonial, înscrisă în Registrul Asociațiilor și
  // Fundațiilor cu numere de forma 123/A/2015 — nu la Registrul Comerțului. Iar
  // firmele înmatriculate după noiembrie 2022 primesc forma nouă, literă plus
  // treisprezece cifre. Un tipar care cere doar J35/1234/2020 le blochează pe
  // toate trei, iar restul produsului nici măcar nu validează câmpul ăsta.
  companyRegNumber: z
    .string()
    .trim()
    .regex(
      /^([A-Za-z]\d{12,13}|[A-Za-z0-9]{1,7}\/[A-Za-z0-9]{1,4}\/\d{4})$/,
      'Format: J35/1234/2020, J2023012345678 sau 123/A/2015',
    ),
  companyAddress: z.string().min(5, 'Minim 5 caractere'),
  bankAccount: z
    .string()
    .transform((s) => s.replace(/\s+/g, '').toUpperCase())
    // A Romanian IBAN is 24 characters: RO, two check digits, then twenty more.
    .refine((s) => /^RO\d{2}[A-Z0-9]{20}$/.test(s), 'IBAN invalid (ex. RO49AAAA1B31007593840000)'),
  bankName: z.string().min(2, 'Minim 2 caractere'),
})
type Values = z.infer<typeof schema>

const STEP_FIELDS: (keyof Values)[][] = [
  ['name', 'email', 'phone', 'password'],
  [
    'clubName',
    // Optional, but validated when filled: left out of this list, a malformed
    // address passes the step and then fails the whole-schema check on the
    // confirmation step, where its message has nowhere to render.
    'clubEmail',
    'companyName',
    'companyCui',
    'companyRegNumber',
    'companyAddress',
    'bankAccount',
    'bankName',
  ],
]
/** The confirmation step — the only one allowed to register anything. */
const CONFIRM_STEP = 2

export default function ClubSignupPage() {
  const navigate = useNavigate()
  const returnUrl = useReturnUrl()
  const { user, loading, refresh } = useAuth()
  const [step, setStep] = useState(0)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' })

  const next = async () => {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1)
  }

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const res = await registerClub({
      email: v.email,
      password: v.password,
      name: v.name,
      phone: v.phone || undefined,
      clubName: v.clubName,
      clubDescription: v.clubDescription || undefined,
      clubCity: v.clubCity || undefined,
      clubEmail: v.clubEmail || undefined,
      clubPhone: v.clubPhone || undefined,
      companyName: v.companyName,
      companyCui: v.companyCui,
      companyRegNumber: v.companyRegNumber,
      companyAddress: v.companyAddress,
      bankAccount: v.bankAccount,
      bankName: v.bankName,
      sportIds,
    })
    if ('error' in res && res.error) {
      setServerError(res.error.message)
      setStep(0)
      return
    }
    await refresh()
    // This page only ever creates club owners, so their panel is the
    // destination unless the visitor was already on their way somewhere.
    navigate(returnUrl || roleHome('CLUB'))
  }

  /**
   * The confirmation step renders no field, so it renders no field error
   * either. A value that slipped past its own step would make Finalizează do
   * nothing at all, in silence — so whatever is invalid, send the visitor back
   * to the step that can actually show it.
   */
  const onInvalid = (invalide: FieldErrors<Values>) => {
    const primul = Object.keys(invalide)[0] as keyof Values | undefined
    if (!primul) return
    const pas = STEP_FIELDS.findIndex((campuri) => campuri.includes(primul))
    if (pas >= 0) setStep(pas)
  }

  // Enter inside a field submits the form. On the first two steps that has to
  // move the wizard along, never register the club.
  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step < CONFIRM_STEP) void next()
    else void handleSubmit(onSubmit, onInvalid)()
  }

  if (loading) {
    return (
      <AuthLayout title="Înregistrare club" subtitle="Creează contul administratorului și clubul">
        <p className="text-muted-foreground text-sm">Se verifică sesiunea…</p>
      </AuthLayout>
    )
  }

  // Someone already signed in cannot create a second account from here; send
  // them where they were headed, or to the panel their role belongs to.
  if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />

  return (
    <AuthLayout
      title="Înregistrare club"
      subtitle="Creează contul administratorului și clubul"
      footer={
        <Link to={withReturnUrl('/signup', returnUrl)} className="text-primary font-semibold">
          Înapoi
        </Link>
      }
    >
      <StepDots count={3} current={step} />
      {serverError && (
        <p className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}
      <form onSubmit={onFormSubmit} className="space-y-4" noValidate>
        {step === 0 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nume administrator</Label>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon (opțional)</Label>
              <Input id="phone" type="tel" placeholder="+40..." {...register('phone')} aria-invalid={!!errors.phone} />
              {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Parolă</Label>
              <Input id="password" type="password" {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="clubName">Nume club</Label>
              <Input id="clubName" {...register('clubName')} aria-invalid={!!errors.clubName} />
              {errors.clubName && <p className="text-destructive text-xs">{errors.clubName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clubCity">Oraș (opțional)</Label>
              <Input id="clubCity" {...register('clubCity')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clubEmail">Email club (opțional)</Label>
              <Input id="clubEmail" type="email" {...register('clubEmail')} aria-invalid={!!errors.clubEmail} />
              {errors.clubEmail && <p className="text-destructive text-xs">{errors.clubEmail.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Sporturi</Label>
              <SportPicker sports={sports} value={sportIds} onChange={setSportIds} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName">Denumire fiscală</Label>
              <Input id="companyName" {...register('companyName')} aria-invalid={!!errors.companyName} />
              {errors.companyName && (
                <p className="text-destructive text-xs">{errors.companyName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyCui">CUI</Label>
              <Input id="companyCui" placeholder="RO12345678" {...register('companyCui')} aria-invalid={!!errors.companyCui} />
              {errors.companyCui && (
                <p className="text-destructive text-xs">{errors.companyCui.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyRegNumber">Nr. înregistrare (Reg. Com. / RAF)</Label>
              <Input id="companyRegNumber" placeholder="J35/1234/2020 sau 123/A/2015" {...register('companyRegNumber')} aria-invalid={!!errors.companyRegNumber} />
              {errors.companyRegNumber && (
                <p className="text-destructive text-xs">{errors.companyRegNumber.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyAddress">Adresă firmă</Label>
              <Input id="companyAddress" {...register('companyAddress')} aria-invalid={!!errors.companyAddress} />
              {errors.companyAddress && (
                <p className="text-destructive text-xs">{errors.companyAddress.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">IBAN</Label>
              <Input id="bankAccount" placeholder="RO49AAAA1B31007593840000" {...register('bankAccount')} aria-invalid={!!errors.bankAccount} />
              {errors.bankAccount && (
                <p className="text-destructive text-xs">{errors.bankAccount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bancă</Label>
              <Input id="bankName" {...register('bankName')} aria-invalid={!!errors.bankName} />
              {errors.bankName && (
                <p className="text-destructive text-xs">{errors.bankName.message}</p>
              )}
            </div>
          </>
        )}

        {step === CONFIRM_STEP && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Verifică datele înainte de finalizare:</p>
            <div className="bg-muted space-y-1 rounded-2xl p-4">
              <div>
                <span className="text-muted-foreground">Administrator:</span> {getValues('name')}
              </div>
              <div>
                <span className="text-muted-foreground">Club:</span> {getValues('clubName')}
              </div>
              <div>
                <span className="text-muted-foreground">Oraș:</span> {getValues('clubCity') || '—'}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Configurarea Stripe pentru încasări se face din panoul de club, după înregistrare.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Înapoi
            </Button>
          )}
          {step < CONFIRM_STEP ? (
            <Button type="button" className="flex-1" onClick={next}>
              Continuă
            </Button>
          ) : (
            // Both buttons render in the same slot, so React hands the new one
            // the DOM node the previous click landed on. A type="submit" here
            // would inherit that click and register the club the moment the
            // confirmation step appeared, so registering stays an explicit
            // onClick that only a second, deliberate press can reach.
            <Button
              type="button"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(onSubmit, onInvalid)()}
            >
              {isSubmitting ? 'Se creează…' : 'Finalizează'}
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
