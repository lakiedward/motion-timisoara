import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Phone, QrCode, UserCheck } from 'lucide-react'

import { varstaLa, type CopilInscris } from '@/api/camp-enrolled'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { CampPortalBaza } from '../camp-portal'
import { TIPURI_ALERTA, TON_CLASE, alerteCopil, areAlerta, type CheieAlerta } from './child-alerts'

export default function EnrolledList({
  inscrisi,
  ziuaTaberei,
  baza,
  sosire,
}: {
  inscrisi: CopilInscris[]
  ziuaTaberei: string | null
  baza: CampPortalBaza
  sosire: (c: CopilInscris) => ReactNode
}) {
  const [filtru, setFiltru] = useState<CheieAlerta | null>(null)
  const grupuri = TIPURI_ALERTA.map((tip) => ({
    tip,
    numar: inscrisi.filter((c) => areAlerta(c, tip.cheie)).length,
  })).filter((g) => g.numar > 0)
  const activ = grupuri.some((g) => g.tip.cheie === filtru) ? filtru : null
  const vizibili = activ ? inscrisi.filter((c) => areAlerta(c, activ)) : inscrisi

  return (
    <>
      {grupuri.length > 0 && (
        <section aria-labelledby="de-stiut" className="bg-card mt-4 rounded-2xl border p-4 sm:p-5">
          <h2 id="de-stiut" className="text-lg font-semibold">
            De știut
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Apasă pe o categorie ca să vezi doar copiii respectivi.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              variant={activ ? 'outline' : 'default'}
              aria-pressed={!activ}
              onClick={() => setFiltru(null)}
            >
              Toți · {inscrisi.length}
            </Button>
            {grupuri.map(({ tip, numar }) => {
              const apasat = activ === tip.cheie
              const Icon = tip.icon
              return (
                <Button
                  key={tip.cheie}
                  type="button"
                  variant="outline"
                  aria-pressed={apasat}
                  onClick={() => setFiltru(apasat ? null : tip.cheie)}
                  className={cn(
                    'rounded-full',
                    apasat && 'ring-ring ring-2 ring-offset-2',
                    TON_CLASE[tip.ton],
                  )}
                >
                  <Icon aria-hidden="true" />
                  {tip.eticheta} · {numar}
                </Button>
              )
            })}
          </div>
        </section>
      )}

      <ul className="mt-4 space-y-3">
        {vizibili.map((c) => (
          <li key={c.enrollmentId}>
            <CardCopil copil={c} ziuaTaberei={ziuaTaberei} baza={baza} sosire={sosire(c)} />
          </li>
        ))}
      </ul>
    </>
  )
}

function CardCopil({
  copil,
  ziuaTaberei,
  baza,
  sosire,
}: {
  copil: CopilInscris
  ziuaTaberei: string | null
  baza: CampPortalBaza
  sosire: ReactNode
}) {
  const eAdult = copil.fel === 'adult'
  const varsta = !eAdult && ziuaTaberei ? varstaLa(copil.dataNasterii, ziuaTaberei) : null
  const alerte = alerteCopil(copil)
  const cuText = alerte.filter((a) => a.tip.ton === 'danger' || a.tip.ton === 'warn')

  return (
    <article className="bg-card rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-base font-semibold tracking-normal">{copil.nume}</h3>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {eAdult
              ? 'Adult'
              : varsta !== null
                ? `${plural(varsta, 'an', 'ani')} la începutul taberei`
                : 'Vârstă necunoscută'}
            {!eAdult && copil.marimeTricou ? ` · tricou ${copil.marimeTricou}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {eAdult && <Badge variant="outline">Adult</Badge>}
          <Badge variant={copil.stare === 'ACTIVE' ? 'default' : 'secondary'}>
            {copil.stare === 'ACTIVE' ? 'Înscris' : 'Plata în curs'}
          </Badge>
          {!eAdult && copil.copilId && (
            <Button asChild size="sm" variant="outline" className="h-11 min-h-11 lg:h-9 lg:min-h-9">
              <Link
                to={`${baza === '/club/camps' ? '/club' : '/coach'}/children/${copil.copilId}/qr`}
              >
                <QrCode className="size-4" /> Cod QR
              </Link>
            </Button>
          )}
        </div>
      </div>

      {alerte.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="De știut despre copil">
          {alerte.map(({ tip }) => {
            const Icon = tip.icon
            return (
              <li
                key={tip.cheie}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                  TON_CLASE[tip.ton],
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tip.eticheta}
              </li>
            )
          })}
        </ul>
      )}

      {cuText.length > 0 && (
        <dl className="bg-muted mt-3 space-y-2 rounded-xl p-3 text-sm">
          {cuText.map(({ tip, detaliu }) => (
            <div key={tip.cheie} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <dt className="text-muted-foreground">{tip.eticheta}</dt>
              <dd className="text-foreground font-medium whitespace-pre-line">{detaliu}</dd>
            </div>
          ))}
        </dl>
      )}

      <Contacte copil={copil} />
      {sosire}
    </article>
  )
}

function Contacte({ copil }: { copil: CopilInscris }) {
  const telefoane = [
    { nume: copil.contactUrgenta ?? 'Contact de urgență', tel: copil.telefonUrgenta },
    { nume: copil.contactSecundar ?? 'Al doilea contact', tel: copil.telefonSecundar },
  ].filter((t) => t.tel)
  if (telefoane.length === 0 && !copil.cineRidica) return null
  return (
    <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
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
