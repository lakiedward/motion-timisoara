import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, QrCode } from 'lucide-react'
import { toast } from 'sonner'

import { createChild, getChild, updateChild } from '@/api/account'
import { toIso } from '@/lib/camp-period'
import { formatLevel, toLevelSlug } from '@/lib/level'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const selectCls =
  'border-input dark:bg-input/30 flex h-touch-target w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none hover:border-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-sm'

const TELEFON = /^\+?[0-9]{8,15}$/
const doarNumarul = (s: string) => s.replace(/[\s().-]/g, '')
const eTelefonValid = (s: string) => TELEFON.test(doarNumarul(s))
const azi = () => toIso(new Date())

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
  emergency_contact_name: obligatoriu(2),
  emergency_phone: z.string().min(1, 'Obligatoriu').refine(eTelefonValid, 'Număr de telefon invalid'),
  secondary_contact_name: z.string().optional(),
  secondary_phone: z
    .string()
    .optional()
    .refine((s) => !s || eTelefonValid(s), 'Număr de telefon invalid'),
  tshirt_size: z.string().optional(),
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

  if (isEdit && aEsuatCitirea) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <div role="alert" className="mt-6 rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca copilul.</p>
          <Button className="mt-4" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      </div>
    )
  }

  if (isEdit && (!idArataAUuid || (!seIncarca && !existing))) {
    return (
      <div className="mx-auto max-w-2xl">
        <InapoiLaCopii />
        <p className="text-muted-foreground mt-6">Copilul nu a fost găsit.</p>
      </div>
    )
  }

  const camp = (nume: keyof Values) => ({
    'aria-invalid': !!errors[nume],
    'aria-describedby': fieldDescription(nume, undefined, errors[nume]?.message),
  })

  return (
    <div className="mx-auto max-w-2xl">
      <InapoiLaCopii />
      <h1 className="font-display text-foreground mt-4 text-2xl font-bold">
        {isEdit ? 'Editează copil' : 'Adaugă copil'}
      </h1>
      <p className="text-muted-foreground mt-1 text-xs">
        Câmpurile marcate cu <span className="text-destructive">*</span> sunt obligatorii.
      </p>
      {isEdit && (
        <Button asChild variant="outline" className="mt-3">
          <Link to={`/account/child/${id}/qr`}>
            <QrCode className="size-4" /> Codul QR al copilului
          </Link>
        </Button>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6" noValidate>
        <Card>
          <CardContent className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="allergies">Alergii / observații</Label>
              <Textarea id="allergies" rows={4} className="max-h-64 [field-sizing:content]" {...register('allergies')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="emergency_contact_name">
                  Contact urgență <Obligatoriu />
                </Label>
                <Input
                  id="emergency_contact_name"
                  required
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
                  {...register('emergency_phone')}
                  {...camp('emergency_phone')}
                />
                <FieldMessage id="emergency_phone" error={errors.emergency_phone?.message} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="secondary_contact_name">Contact secundar</Label>
                <Input
                  id="secondary_contact_name"
                  {...register('secondary_contact_name')}
                />
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
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează'}
          </Button>
          <Button type="button" variant="outline" asChild>
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
      className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" /> Înapoi
    </Link>
  )
}
