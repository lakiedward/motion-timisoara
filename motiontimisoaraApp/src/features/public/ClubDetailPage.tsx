import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Globe, Mail, MapPin, Phone } from 'lucide-react'

import { getPublicClub, publicUrl } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubDetailPage() {
  const { id = '' } = useParams()
  const { data: club, isLoading } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getPublicClub(id),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    )
  }
  if (!club) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Clubul nu a fost găsit.</p>
        <Link to="/cluburi" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la cluburi
        </Link>
      </div>
    )
  }

  const logo = publicUrl('club-assets', club.logo_storage_path)
  const cover = publicUrl('club-assets', club.hero_photo_storage_path)

  return (
    <div>
      <div className="from-primary to-sky relative h-48 bg-gradient-to-br md:h-60">
        {cover && <img src={cover} alt="" className="size-full object-cover opacity-60" />}
      </div>
      <div className="mx-auto max-w-5xl px-6">
        <Link
          to="/cluburi"
          className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi la cluburi
        </Link>
        <div className="-mt-16 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="bg-card size-28 shrink-0 overflow-hidden rounded-3xl border-4 border-background shadow-md">
            {logo ? (
              <img src={logo} alt={club.name} className="size-full object-cover" />
            ) : (
              <div className="bg-primary/10 text-primary grid size-full place-items-center text-3xl font-bold">
                {club.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="pb-2">
            <h1 className="font-display text-3xl font-extrabold text-foreground">{club.name}</h1>
            {club.city && (
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPin className="size-4" /> {club.city}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-8 pb-16 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {club.description && (
              <>
                <h2 className="font-display text-xl font-bold">Despre club</h2>
                <p className="text-muted-foreground mt-2 leading-relaxed">{club.description}</p>
              </>
            )}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {club.club_sports
                ?.map((cs) => cs.sport)
                .filter(Boolean)
                .map((s) => (
                  <Badge key={s!.id}>{s!.name}</Badge>
                ))}
            </div>
          </div>
          <aside className="bg-card shadow-card h-fit space-y-3 rounded-3xl border p-6 text-sm">
            <h3 className="font-display font-bold">Contact</h3>
            {club.website && (
              <a href={club.website} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-2">
                <Globe className="size-4" /> Website
              </a>
            )}
            {club.public_email_consent && club.email && (
              <a href={`mailto:${club.email}`} className="flex items-center gap-2">
                <Mail className="size-4" /> {club.email}
              </a>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="flex items-center gap-2">
                <Phone className="size-4" /> {club.phone}
              </a>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
