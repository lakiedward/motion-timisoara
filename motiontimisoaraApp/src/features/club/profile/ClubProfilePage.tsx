import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, updateClub, type Club } from '@/api/club'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import ClubAddressFields from './ClubAddressFields'
import ClubImageField from './ClubImageField'
import { clubProfileSchema, normalizeWebsite, type ClubProfileValues } from './clubProfileSchema'

const EMPTY: ClubProfileValues = {
  name: '',
  description: '',
  website: '',
  email: '',
  phone: '',
  county: '',
  city: '',
  address: '',
  lat: null,
  lng: null,
  public_email_consent: false,
}

function toValues(club: Club): ClubProfileValues {
  return {
    name: club.name,
    description: club.description ?? '',
    website: club.website ?? '',
    email: club.email ?? '',
    phone: club.phone ?? '',
    county: normalizeCounty(club.county) ?? club.county ?? countyForCity(club.city) ?? '',
    city: club.city ?? '',
    address: club.address ?? '',
    lat: club.lat ?? null,
    lng: club.lng ?? null,
    public_email_consent: club.public_email_consent,
  }
}

const cardClass = 'bg-card shadow-card space-y-4 rounded-3xl border p-6'
const headingClass = 'font-display text-xl font-bold text-foreground'

export default function ClubProfilePage() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const club = query.data

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClubProfileValues>({ resolver: zodResolver(clubProfileSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (club) reset(toValues(club), { keepDirtyValues: true })
  }, [club, reset])

  if (query.isPending)
    return (
      <div role="status" aria-label="Se încarcă profilul clubului">
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    )
  if (query.isError)
    return (
      <div role="alert" className="max-w-2xl space-y-3 rounded-2xl border p-4">
        <p className="text-destructive text-sm">Nu am putut încărca profilul clubului.</p>
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
    )
  if (!club) return <p className="text-muted-foreground">Niciun club asociat.</p>

  const onSubmit = async (v: ClubProfileValues) => {
    const website = normalizeWebsite(v.website)
    try {
      await updateClub(club.id, {
        name: v.name.trim(),
        description: v.description || null,
        website: website || null,
        email: v.email || null,
        phone: v.phone || null,
        county: v.county || null,
        city: v.city || null,
        address: v.address || null,
        lat: v.lat ?? null,
        lng: v.lng ?? null,
        public_email_consent: v.public_email_consent,
      })
      reset({ ...v, website })
      void qc.invalidateQueries({ queryKey: ['my-club'] })
      toast.success('Profil actualizat.')
    } catch {
      toast.error('Nu am putut salva profilul.')
    }
  }

  const field = (id: keyof ClubProfileValues, label: string, type = 'text') => {
    const message = errors[id]?.message
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          className="min-h-11"
          {...register(id)}
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
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">Profil club</h1>
        <Link
          to={`/cluburi/${club.id}`}
          className="text-primary inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          <ExternalLink className="size-4" /> Vezi pagina publică
        </Link>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section aria-labelledby="club-public-heading" className={cardClass}>
          <h2 id="club-public-heading" className={headingClass}>
            Date publice
          </h2>
          {field('name', 'Nume club')}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descriere</Label>
            <textarea
              id="description"
              rows={3}
              aria-describedby="description-hint"
              {...register('description')}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
            <p id="description-hint" className="text-muted-foreground text-xs">
              Apare pe pagina publică a clubului.
            </p>
          </div>
          {field('website', 'Website (opțional)', 'url')}
          <div className="grid gap-4 sm:grid-cols-2">
            <ClubImageField clubId={club.id} kind="logo" path={club.logo_storage_path} />
            <ClubImageField clubId={club.id} kind="hero" path={club.hero_photo_storage_path} />
          </div>
        </section>

        <section aria-labelledby="club-contact-heading" className={cardClass}>
          <h2 id="club-contact-heading" className={headingClass}>
            Contact
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('email', 'Email', 'email')}
            {field('phone', 'Telefon', 'tel')}
          </div>
          <ClubAddressFields control={control} setValue={setValue} />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" {...register('public_email_consent')} className="size-4" />
            Afișează emailul public pe pagina clubului
          </label>
        </section>

        <Button type="submit" className="min-h-11" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
