import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'

import { publicUrl, type ClubListItem } from '@/api/public'
import { cn } from '@/lib/utils'
import { PublicHeroBand } from '../PublicHeroBand'

function ClubLogo({ name, url, onPhoto }: { name: string; url: string | null; onPhoto: boolean }) {
  return (
    <div
      className={cn(
        'bg-card size-20 shrink-0 overflow-hidden rounded-xl border md:size-24',
        onPhoto && 'border-white/40',
      )}
    >
      {url ? (
        <img src={url} alt={`Logo ${name}`} className="size-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="bg-primary/12 text-primary grid size-full place-items-center text-2xl font-bold md:text-3xl"
        >
          {name.charAt(0).toLocaleUpperCase('ro')}
        </div>
      )}
    </div>
  )
}

export function ClubHero({ club }: { club: ClubListItem }) {
  const logo = publicUrl('club-assets', club.logo_storage_path)
  const cover = publicUrl('club-assets', club.hero_photo_storage_path)

  if (cover) {
    return (
      <PublicHeroBand
        url={cover}
        title={club.name}
        backTo="/cluburi"
        backLabel="Înapoi la cluburi"
        width="max-w-5xl"
        media={<ClubLogo name={club.name} url={logo} onPhoto />}
      >
        {club.city && (
          <p className="mt-1 flex items-center gap-1 text-sm text-white/85">
            <MapPin className="size-4" /> {club.city}
          </p>
        )}
      </PublicHeroBand>
    )
  }

  return (
    <section data-section="club-hero" className="mx-auto max-w-5xl px-6 pt-8">
      <Link
        to="/cluburi"
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la cluburi
      </Link>
      <div className="mt-4 flex min-w-0 items-center gap-4">
        <ClubLogo name={club.name} url={logo} onPhoto={false} />
        <div className="min-w-0 wrap-anywhere">
          <h1 className="font-display text-foreground text-3xl font-extrabold md:text-4xl">
            {club.name}
          </h1>
          {club.city && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
              <MapPin className="size-4" /> {club.city}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
