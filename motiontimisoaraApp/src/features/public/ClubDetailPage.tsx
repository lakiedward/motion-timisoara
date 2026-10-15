import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Globe, Mail, MapPin, Phone } from 'lucide-react'

import { getPublicClub } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClubHero } from './club-detail/ClubHero'
import ClubLocationMap from './map/ClubLocationMap'

export default function ClubDetailPage() {
  const { id = '' } = useParams()
  const { data: club, isLoading, isError, refetch } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getPublicClub(id),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca clubul.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!club) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Clubul nu a fost găsit.</p>
        <Link
          to="/cluburi"
          className="text-primary mt-4 inline-flex h-11 items-center font-semibold"
        >
          ← Înapoi la cluburi
        </Link>
      </div>
    )
  }

  return (
    <div>
      <ClubHero club={club} />
      <div className="mx-auto max-w-5xl px-6">
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
            {(club.address || club.city) && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {[club.address, club.city].filter(Boolean).join(', ')}
              </p>
            )}
            {club.website && (
              <a
                href={club.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary flex items-center gap-2"
              >
                <Globe className="size-4" /> Website
              </a>
            )}
            {club.public_email && (
              <a href={`mailto:${club.public_email}`} className="flex items-center gap-2">
                <Mail className="size-4" /> {club.public_email}
              </a>
            )}
            {club.phone && (
              <a href={`tel:${club.phone}`} className="flex items-center gap-2">
                <Phone className="size-4" /> {club.phone}
              </a>
            )}
            {club.lat != null && club.lng != null && (
              <ClubLocationMap
                lat={club.lat}
                lng={club.lng}
                label={[club.address, club.city].filter(Boolean).join(', ') || club.name}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
