import { Globe, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'

import type { ClubListItem } from '@/api/public'
import { cn } from '@/lib/utils'
import ClubLocationMap from '../map/ClubLocationMap'
import { clubAddress, clubContactRows, type ContactKind, type ContactRow } from './club-contact'

const ICONS: Record<ContactKind, LucideIcon> = {
  address: MapPin,
  phone: Phone,
  email: Mail,
  website: Globe,
}

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function ClubContact({ club, className }: { club: ClubListItem; className?: string }) {
  const rows = clubContactRows(club)
  const hasPoint = club.lat != null && club.lng != null
  const mapLabel = clubAddress(club) || club.name

  return (
    <section
      aria-labelledby="club-contact-title"
      className={cn('bg-card h-fit rounded-xl border p-5 sm:p-6', className)}
    >
      <h2 id="club-contact-title" className="font-display text-xl font-bold">
        Contact
      </h2>
      {rows.length === 0 && !hasPoint ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Clubul nu a publicat încă date de contact.
        </p>
      ) : (
        <>
          <ul className="divide-border mt-3 divide-y">
            {rows.map((row) => (
              <li key={row.kind}>
                <ContactLine row={row} />
              </li>
            ))}
          </ul>
          {hasPoint && (
            <ClubLocationMap lat={club.lat!} lng={club.lng!} label={mapLabel} className="mt-4" />
          )}
        </>
      )}
    </section>
  )
}

function ContactLine({ row }: { row: ContactRow }) {
  const Icon = ICONS[row.kind]
  const body = (
    <>
      <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="text-muted-foreground block text-xs">{row.label}</span>
        <span
          className={cn(
            'block text-sm font-semibold break-words',
            row.href ? 'text-primary underline-offset-2 group-hover:underline' : 'text-foreground',
          )}
        >
          {row.value}
        </span>
      </span>
    </>
  )
  const layout = 'flex min-h-touch-target items-center gap-3 py-2'

  if (!row.href) return <div className={layout}>{body}</div>
  return (
    <a
      href={row.href}
      target={row.external ? '_blank' : undefined}
      rel={row.external ? 'noopener noreferrer' : undefined}
      className={cn('group rounded-md', layout, FOCUS_RING)}
    >
      {body}
    </a>
  )
}
