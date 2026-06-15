import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyClub, updateClub } from '@/api/club'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  description: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email('Email invalid').optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  public_email_consent: z.boolean(),
  company_name: z.string().optional(),
  company_cui: z.string().optional(),
  bank_account: z.string().optional(),
  bank_name: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function ClubProfilePage() {
  const qc = useQueryClient()
  const { data: club, isLoading } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { public_email_consent: false } })

  useEffect(() => {
    if (club) {
      reset({
        name: club.name,
        description: club.description ?? '',
        website: club.website ?? '',
        email: club.email ?? '',
        phone: club.phone ?? '',
        city: club.city ?? '',
        address: club.address ?? '',
        public_email_consent: club.public_email_consent,
        company_name: club.company_name ?? '',
        company_cui: club.company_cui ?? '',
        bank_account: club.bank_account ?? '',
        bank_name: club.bank_name ?? '',
      })
    }
  }, [club, reset])

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (!club) return <p className="text-muted-foreground">Niciun club asociat.</p>

  const onSubmit = async (v: Values) => {
    try {
      await updateClub(club.id, {
        name: v.name,
        description: v.description || null,
        website: v.website || null,
        email: v.email || null,
        phone: v.phone || null,
        city: v.city || null,
        address: v.address || null,
        public_email_consent: v.public_email_consent,
        company_name: v.company_name || null,
        company_cui: v.company_cui || null,
        bank_account: v.bank_account || null,
        bank_name: v.bank_name || null,
      })
      qc.invalidateQueries({ queryKey: ['my-club'] })
      toast.success('Profil actualizat.')
    } catch {
      toast.error('Nu am putut salva profilul.')
    }
  }

  const field = (id: keyof Values, label: string, type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} {...register(id)} aria-invalid={!!errors[id]} />
      {errors[id] && <p className="text-destructive text-xs">{errors[id]?.message as string}</p>}
    </div>
  )

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Profil club</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="bg-card shadow-card space-y-4 rounded-3xl border p-6">
          <h2 className="font-semibold">Date publice</h2>
          {field('name', 'Nume club')}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descriere</Label>
            <textarea
              id="description"
              rows={3}
              {...register('description')}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
          {field('website', 'Website')}
        </section>

        <section className="bg-card shadow-card space-y-4 rounded-3xl border p-6">
          <h2 className="font-semibold">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('email', 'Email', 'email')}
            {field('phone', 'Telefon', 'tel')}
            {field('city', 'Oraș')}
            {field('address', 'Adresă')}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('public_email_consent')} className="size-4" />
            Afișează emailul public pe pagina clubului
          </label>
        </section>

        <section className="bg-card shadow-card space-y-4 rounded-3xl border p-6">
          <h2 className="font-semibold">Date facturare</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('company_name', 'Denumire firmă')}
            {field('company_cui', 'CUI')}
            {field('bank_name', 'Bancă')}
            {field('bank_account', 'IBAN')}
          </div>
        </section>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
