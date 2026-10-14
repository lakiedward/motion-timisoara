import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'

import type { AntrenorTabara, OrganizatorTabara } from '@/api/camps'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const SECTION_KEY = 'motion-react:page:/tabere/:slug:section:organizator-si-antrenori'

const CARD = 'bg-card flex min-h-touch-target items-center gap-4 rounded-xl border p-4'

const LINK_CARD = `${CARD} shadow-card hover:shadow-card-hover hover:border-foreground/20 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`

export function CampOrganizerCoaches({
  organizator,
  antrenori,
}: {
  organizator: OrganizatorTabara | null
  antrenori: AntrenorTabara[]
}) {
  if (!organizator && antrenori.length === 0) return null

  return (
    <div data-section={SECTION_KEY} className="mt-8 space-y-8">
      {organizator && (
        <section>
          <h2 className="font-display mb-3 text-lg font-bold">Organizată de</h2>
          <Link to={organizator.link} className={LINK_CARD}>
            {organizator.fel === 'club' ? (
              <span className="bg-primary/12 text-primary grid size-14 shrink-0 place-items-center rounded-full">
                <Building2 aria-hidden="true" className="size-6" />
              </span>
            ) : (
              <PersonAvatar name={organizator.nume} src={null} />
            )}
            <CardText
              title={organizator.nume}
              hint={
                organizator.fel === 'club'
                  ? 'Club · Vezi pagina clubului'
                  : 'Antrenor · Vezi profilul antrenorului'
              }
            />
          </Link>
        </section>
      )}

      {antrenori.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-lg font-bold">
            {antrenori.length === 1 ? 'Antrenorul care însoțește' : 'Antrenorii care însoțesc'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {antrenori.map((antrenor) => {
              const body = (
                <>
                  <PersonAvatar name={antrenor.nume} src={antrenor.pozaUrl} />
                  <CardText
                    title={antrenor.nume}
                    hint={antrenor.link ? 'Vezi profilul antrenorului' : undefined}
                  />
                </>
              )
              return (
                <li key={antrenor.id}>
                  {antrenor.link ? (
                    <Link to={antrenor.link} className={LINK_CARD}>
                      {body}
                    </Link>
                  ) : (
                    <div className={CARD}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function PersonAvatar({ name, src }: { name: string; src: string | null }) {
  return (
    <Avatar className="size-14">
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="text-lg">{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function CardText({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="text-foreground block font-semibold break-words">{title}</span>
      {hint && <span className="text-muted-foreground text-sm">{hint}</span>}
    </span>
  )
}
