import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { createChild, getChild, updateChild } from '@/api/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  birth_date: z.string().min(1, 'Obligatoriu'),
  level: z.string().optional(),
  allergies: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  secondary_contact_name: z.string().optional(),
  secondary_phone: z.string().optional(),
  tshirt_size: z.string().optional(),
})
type Values = z.infer<typeof schema>

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'

export default function ChildFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: existing } = useQuery({
    queryKey: ['child', id],
    queryFn: () => getChild(id as string),
    enabled: isEdit,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        birth_date: existing.birth_date,
        level: existing.level ?? '',
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

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/account/children" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{isEdit ? 'Editează copil' : 'Adaugă copil'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nume</Label>
            <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">Data nașterii</Label>
            <Input id="birth_date" type="date" {...register('birth_date')} aria-invalid={!!errors.birth_date} />
            {errors.birth_date && <p className="text-destructive text-xs">{errors.birth_date.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level">Nivel</Label>
            <select id="level" className={cn(selectCls)} {...register('level')}>
              <option value="">—</option>
              <option value="incepator">Începător</option>
              <option value="intermediar">Intermediar</option>
              <option value="avansat">Avansat</option>
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
          <Input id="allergies" {...register('allergies')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emergency_contact_name">Contact urgență</Label>
            <Input id="emergency_contact_name" {...register('emergency_contact_name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergency_phone">Telefon urgență</Label>
            <Input id="emergency_phone" type="tel" {...register('emergency_phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secondary_contact_name">Contact secundar</Label>
            <Input id="secondary_contact_name" {...register('secondary_contact_name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secondary_phone">Telefon secundar</Label>
            <Input id="secondary_phone" type="tel" {...register('secondary_phone')} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
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
