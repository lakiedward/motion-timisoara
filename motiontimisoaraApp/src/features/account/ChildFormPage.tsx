import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, QrCode } from 'lucide-react'
import { toast } from 'sonner'

import { createChild, getChild, updateChild } from '@/api/account'
import { formatLevel, toLevelSlug } from '@/lib/level'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9'

/** Același tipar ca la înregistrare (`RegisterPage`), ca să nu avem două reguli de telefon. */
const TELEFON = /^\+?[0-9]{8,15}$/
/** „0722 123 456” e un număr scris de om, nu unul invalid. */
const doarNumarul = (s: string) => s.replace(/[\s().-]/g, '')
const eTelefonValid = (s: string) => TELEFON.test(doarNumarul(s))

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  birth_date: z
    .string()
    .min(1, 'Obligatoriu')
    // O dată din viitor trecea, iar copilul apărea în listă cu vârstă negativă.
    .refine((s) => s <= new Date().toISOString().slice(0, 10), 'Data nu poate fi în viitor'),
  level: z.string().optional(),
  allergies: z.string().optional(),
  emergency_contact_name: z.string().min(2, 'Minim 2 caractere'),
  emergency_phone: z.string().min(1, 'Obligatoriu').refine(eTelefonValid, 'Număr de telefon invalid'),
  secondary_contact_name: z.string().optional(),
  secondary_phone: z
    .string()
    .optional()
    // Secundarul rămâne opțional, dar dacă e scris trebuie să fie un număr real:
    // un contact de rezervă la care nu poți suna nu e un contact de rezervă.
    .refine((s) => !s || eTelefonValid(s), 'Număr de telefon invalid'),
  tshirt_size: z.string().optional(),
})
type Values = z.infer<typeof schema>

/** Steluța de lângă eticheta unui câmp obligatoriu. */
function Obligatoriu() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}

/** Forma unui id de copil. Orice altceva nu poate potrivi niciun rând. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ChildFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  // Un id malformat nu ajunge la server: cererea ar pica oricum cu 400 și ar lăsa
  // o eroare în consolă pentru un caz pe care îl știm dinainte.
  const idArataAUuid = !isEdit || UUID.test(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
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
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  /**
   * Nivelul salvat, adus la forma din listă. Când nu-l recunoaștem îl păstrăm ca
   * atare și îi facem loc în listă mai jos — altfel selectul ar rămâne fără nicio
   * opțiune aleasă, iar prima salvare ar șterge un nivel pe care nimeni nu l-a atins.
   */
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
        emergency_contact_name: existing.emergency_contact_name ?? '',
        emergency_phone: existing.emergency_phone ?? '',
        secondary_contact_name: existing.secondary_contact_name ?? '',
        secondary_phone: existing.secondary_phone ?? '',
        tshirt_size: existing.tshirt_size ?? '',
      })
    }
  }, [existing, reset])

  const onSubmit = async (v: Values) => {
    try {
      if (isEdit) await updateChild(id as string, v)
      else await createChild(v)
      qc.invalidateQueries({ queryKey: ['children'] })
      toast.success(isEdit ? 'Copil actualizat.' : 'Copil adăugat.')
      navigate('/account/children')
    } catch {
      toast.error('Nu am putut salva. Încearcă din nou.')
    }
  }

  // O citire căzută nu e totuna cu un copil inexistent: prima se reîncearcă, a
  // doua nu are ce reîncerca.
  if (isEdit && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <div role="alert" className="mt-6 rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca copilul.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      </div>
    )
  }

  // Un id care nu duce nicăieri nu are voie să deschidă un formular gol, editabil,
  // cu buton de salvare: părintele ar completa date pentru un copil inexistent.
  // `seIncarca` nu se termină niciodată când interogarea e oprită, deci id-ul
  // malformat se tratează separat, înaintea lui.
  if (isEdit && (!idArataAUuid || (!seIncarca && !existing))) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <p className="text-muted-foreground mt-6">Copilul nu a fost găsit.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <InapoiLaCopii />
      <h1 className="font-display mt-4 text-2xl font-bold">
        {isEdit ? 'Editează copil' : 'Adaugă copil'}
      </h1>
      <p className="text-muted-foreground mt-1 text-xs">
        Câmpurile marcate cu <span className="text-destructive">*</span> sunt obligatorii.
      </p>
      {isEdit && (
        <Button asChild variant="outline" className="mt-3 h-11 min-h-11">
          <Link to={`/account/child/${id}/qr`}>
            <QrCode className="size-4" /> Codul QR al copilului
          </Link>
        </Button>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Nume <Obligatoriu />
            </Label>
            <Input
              id="name"
              className="h-11 lg:h-9"
              required
              {...register('name')}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-destructive text-xs">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">
              Data nașterii <Obligatoriu />
            </Label>
            <Input
              id="birth_date"
              type="date"
              className="h-11 lg:h-9"
              required
              {...register('birth_date')}
              aria-invalid={!!errors.birth_date}
              aria-describedby={errors.birth_date ? 'birth_date-error' : undefined}
            />
            {errors.birth_date && (
              <p id="birth_date-error" className="text-destructive text-xs">
                {errors.birth_date.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level">Nivel</Label>
            <select id="level" className={cn(selectCls)} {...register('level')}>
              <option value="">—</option>
              <option value="incepator">Începător</option>
              <option value="intermediar">Intermediar</option>
              <option value="avansat">Avansat</option>
              {nivelStrain && <option value={nivelStrain}>{formatLevel(nivelStrain)}</option>}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tshirt_size">Mărime tricou</Label>
            <select id="tshirt_size" className={cn(selectCls)} {...register('tshirt_size')}>
              <option value="">—</option>
              {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="allergies">Alergii / observații</Label>
          {/* Casetă pe mai multe rânduri: aici se scrie medicație și ce trebuie
              evitat, iar părintele trebuie să vadă tot ce a scris dintr-o privire. */}
          <textarea
            id="allergies"
            rows={3}
            {...register('allergies')}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emergency_contact_name">
              Contact urgență <Obligatoriu />
            </Label>
            <Input
              id="emergency_contact_name"
              className="h-11 lg:h-9"
              required
              {...register('emergency_contact_name')}
              aria-invalid={!!errors.emergency_contact_name}
              aria-describedby={
                errors.emergency_contact_name ? 'emergency_contact_name-error' : undefined
              }
            />
            {errors.emergency_contact_name && (
              <p id="emergency_contact_name-error" className="text-destructive text-xs">
                {errors.emergency_contact_name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergency_phone">
              Telefon urgență <Obligatoriu />
            </Label>
            <Input
              id="emergency_phone"
              type="tel"
              className="h-11 lg:h-9"
              required
              {...register('emergency_phone')}
              aria-invalid={!!errors.emergency_phone}
              aria-describedby={errors.emergency_phone ? 'emergency_phone-error' : undefined}
            />
            {errors.emergency_phone && (
              <p id="emergency_phone-error" className="text-destructive text-xs">
                {errors.emergency_phone.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secondary_contact_name">Contact secundar</Label>
            <Input
              id="secondary_contact_name"
              className="h-11 lg:h-9"
              {...register('secondary_contact_name')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secondary_phone">Telefon secundar</Label>
            <Input
              id="secondary_phone"
              type="tel"
              className="h-11 lg:h-9"
              {...register('secondary_phone')}
              aria-invalid={!!errors.secondary_phone}
              aria-describedby={errors.secondary_phone ? 'secondary_phone-error' : undefined}
            />
            {errors.secondary_phone && (
              <p id="secondary_phone-error" className="text-destructive text-xs">
                {errors.secondary_phone.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="h-11 lg:h-9" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" className="h-11 lg:h-9" asChild>
            <Link to="/account/children">Anulează</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}

function InapoiLaCopii() {
  return (
    <Link
      to="/account/children"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> Înapoi
    </Link>
  )
}
