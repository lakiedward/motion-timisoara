import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Phone, QrCode, UserCheck } from 'lucide-react'

import type { CopilInscris } from '@/api/camp-enrolled'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { CampPortalBaza } from '../camp-portal'
import { TON_CLASE, alerteCopil } from './child-alerts'
import { participantAge } from './participant-list'

function Contacte({ copil }: { copil: CopilInscris }) {
  const telefoane = [
    { nume: copil.contactUrgenta ?? 'Contact de urgență', tel: copil.telefonUrgenta },
    { nume: copil.contactSecundar ?? 'Al doilea contact', tel: copil.telefonSecundar },
  ].filter((t) => t.tel)
  if (telefoane.length === 0 && !copil.cineRidica) return null
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
      {telefoane.map((t) => (
        <a
          key={t.tel}
          href={`tel:${t.tel}`}
          className="hover:text-foreground inline-flex min-h-11 items-center gap-2 sm:min-h-0"
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          {t.nume}: {t.tel}
        </a>
      ))}
      {copil.cineRidica && (
        <p className="inline-flex items-start gap-2 sm:items-center">
          <UserCheck className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden="true" />
          <span className="whitespace-pre-line">
            Ridică: {copil.cineRidica.replace(/\n/g, '; ')}
          </span>
        </p>
      )}
    </div>
  )
}

function ParticipantRow({
  copil,
  ziuaTaberei,
  baza,
  sosire,
}: {
  key?: string
  copil: CopilInscris
  ziuaTaberei: string | null
  baza: CampPortalBaza
  sosire: ReactNode
}) {
  const eAdult = copil.fel === 'adult'
  const varsta = participantAge(copil, ziuaTaberei)
  const alerte = alerteCopil(copil)
  const cuText = alerte.filter((a) => a.tip.ton === 'danger' || a.tip.ton === 'warn')

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-start md:gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 font-semibold wrap-anywhere">{copil.nume}</h3>
          {eAdult && <Badge variant="outline">Adult</Badge>}
          {copil.stare === 'PENDING' && <Badge variant="secondary">Plata în curs</Badge>}
          {alerte.map(({ tip }) => {
            const Icon = tip.icon
            return (
              <span
                key={tip.cheie}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                  TON_CLASE[tip.ton],
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tip.eticheta}
              </span>
            )
          })}
        </div>
        <p className="text-muted-foreground text-sm">
          {eAdult ? 'Adult' : varsta !== null ? plural(varsta, 'an', 'ani') : 'Vârstă necunoscută'}
          {!eAdult && copil.marimeTricou ? ` · tricou ${copil.marimeTricou}` : ''}
        </p>
        {cuText.map(({ tip, detaliu }) => (
          <p key={tip.cheie} className="text-sm">
            <span className="text-muted-foreground">{tip.eticheta}: </span>
            <span className="text-foreground font-medium whitespace-pre-line">{detaliu}</span>
          </p>
        ))}
        <Contacte copil={copil} />
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:flex-row-reverse md:items-center">
        {!eAdult && copil.copilId && (
          <Button
            asChild
            variant="outline"
            className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
          >
            <Link
              to={`${baza === '/club/camps' ? '/club' : '/coach'}/children/${copil.copilId}/qr`}
              aria-label={`Cod QR pentru ${copil.nume}`}
            >
              <QrCode aria-hidden="true" /> Cod QR
            </Link>
          </Button>
        )}
        {sosire}
      </div>
    </li>
  )
}

export function ParticipantRows({
  groups,
  ziuaTaberei,
  baza,
  sosire,
}: {
  groups: { key: string; title: string; items: CopilInscris[] }[]
  ziuaTaberei: string | null
  baza: CampPortalBaza
  sosire: (c: CopilInscris) => ReactNode
}) {
  return (
    <div className="grid gap-8">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} className="grid gap-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            {g.title} · {g.items.length}
          </h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {g.items.map((c) => (
              <ParticipantRow
                key={c.enrollmentId}
                copil={c}
                ziuaTaberei={ziuaTaberei}
                baza={baza}
                sosire={sosire(c)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
