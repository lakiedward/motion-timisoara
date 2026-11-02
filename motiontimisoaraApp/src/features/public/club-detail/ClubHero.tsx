import { MapPin } from 'lucide-react'

import { publicUrl, type ClubListItem } from '@/api/public'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { PublicHeroBand } from '../PublicHeroBand'
import { DetailBackLink } from '../components/DetailBackLink'
import { PROFILE_CARD_LAYOUT } from '../coaches/CoachHero'

function ClubLogo({ name, url, onPhoto }: { name: string; url: string | null; onPhoto: boolean }) {
  return (
    <div
      className={cn(
        'bg-card size-24 shrink-0 overflow-hidden rounded-xl border',
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
    <section data-section="club-hero" className="mx-auto max-w-6xl px-6 pt-10">
      <DetailBackLink to="/cluburi" label="Înapoi la cluburi" />
      <Card className={PROFILE_CARD_LAYOUT}>
        <ClubLogo name={club.name} url={logo} onPhoto={false} />
        <div className="min-w-0 wrap-anywhere">
          <h1 className="font-display text-foreground text-3xl font-extrabold md:text-4xl">
            {club.name}
          </h1>
          {club.city && (
            <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1 text-sm sm:justify-start">
              <MapPin className="size-4" /> {club.city}
            </p>
          )}
        </div>
      </Card>
    </section>
  )
}
