import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Phone, QrCode } from 'lucide-react'

import { getInscrisiiTaberei, varstaLa, type CopilInscris } from '@/api/camp-enrolled'
import { getTabaraDeEditat } from '@/api/camps-admin'
import { formatZi } from '@/api/camps'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Lista celor înscriși la o tabără.
 *
 * O văd proprietarul ȘI antrenorii însoțitori, deci nu e sub `/club` sau
 * `/coach` cu drepturi presupuse: baza decide. Cine n-are voie primește o listă
 * goală, nu un ecran de eroare — fiindcă din punctul lui de vedere chiar nu
 * există nimic acolo.
 */
export default function CampEnrolledPage({ baza }: { baza: '/club/camps' | '/coach/camps' }) {
  const { id } = useParams()
  const campId = id as string

  const { data: tabara } = useQuery({
    queryKey: ['tabara-de-editat', campId],
    queryFn: () => getTabaraDeEditat(campId),
  })

  const {
    data: inscrisi = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['inscrisii-taberei', campId],
    queryFn: () => getInscrisiiTaberei(campId),
  })

  const cuAlergii = inscrisi.filter((c) => c.alergii?.trim())

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={baza}
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la tabere
      </Link>

      <h1 className="font-display mt-2 text-2xl font-bold">Cine s-a înscris</h1>
      {tabara && (
        <p className="text-muted-foreground mt-1 text-sm">
          {tabara.title} · {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
        </p>
      )}

      {isError ? (
        <div className="py-16 text-center" role="alert">
          <p className="text-foreground font-medium">Nu am putut încărca lista.</p>
          <Button type="button" className="mt-4 h-11 min-h-11" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground mt-8 text-sm">Se încarcă…</p>
      ) : inscrisi.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-8 text-center">
          <p className="text-foreground font-medium">Niciun copil înscris încă.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Aici apar copiii pe măsură ce părinții îi înscriu, inclusiv cei cu plata în curs.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-6 text-sm">
            {plural(inscrisi.length, 'copil înscris', 'copii înscriși')}
            {tabara?.capacity ? ` din ${plural(tabara.capacity, 'loc', 'locuri')}` : ''}.
          </p>

          {cuAlergii.length > 0 && (
            <div className="border-destructive/40 bg-destructive/5 mt-4 rounded-2xl border p-4">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="size-4" />
                {plural(cuAlergii.length, 'copil are alergii', 'copii au alergii')}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {cuAlergii.map((c) => c.nume).join(', ')}
              </p>
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {inscrisi.map((c) => (
              <li key={c.enrollmentId}>
                <CardCopil copil={c} ziuaTaberei={tabara?.period_start ?? null} baza={baza} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CardCopil({
  copil,
  ziuaTaberei,
  baza,
}: {
  copil: CopilInscris
  ziuaTaberei: string | null
  baza: '/club/camps' | '/coach/camps'
}) {
  const varsta = ziuaTaberei ? varstaLa(copil.dataNasterii, ziuaTaberei) : null

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{copil.nume}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {varsta !== null ? `${plural(varsta, 'an', 'ani')} la începutul taberei` : 'Vârstă necunoscută'}
            {copil.marimeTricou ? ` · tricou ${copil.marimeTricou}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* „În curs de plată" nu e o problemă de rezolvat aici, dar ține un loc,
              deci trebuie să se vadă că nu e la fel cu unul plătit. */}
          <Badge variant={copil.stare === 'ACTIVE' ? 'default' : 'secondary'}>
            {copil.stare === 'ACTIVE' ? 'Înscris' : 'Plata în curs'}
          </Badge>
          {/* Rezerva când părintele n-are telefonul: codul copilului, de pe
              ecranul organizatorului. */}
          <Button asChild size="sm" variant="outline" className="h-11 min-h-11 lg:h-9 lg:min-h-9">
            <Link to={`${baza === '/club/camps' ? '/club' : '/coach'}/children/${copil.copilId}/qr`}>
              <QrCode className="size-4" /> Cod QR
            </Link>
          </Button>
        </div>
      </div>

      {copil.alergii?.trim() && (
        <p className="text-destructive mt-3 inline-flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Alergii:</span> {copil.alergii}
          </span>
        </p>
      )}

      {(copil.telefonUrgenta || copil.telefonSecundar) && (
        <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
          {copil.telefonUrgenta && (
            <li className="inline-flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <a href={`tel:${copil.telefonUrgenta}`} className="hover:text-foreground">
                {copil.contactUrgenta ?? 'Contact de urgență'}: {copil.telefonUrgenta}
              </a>
            </li>
          )}
          {copil.telefonSecundar && (
            <li className="inline-flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <a href={`tel:${copil.telefonSecundar}`} className="hover:text-foreground">
                {copil.contactSecundar ?? 'Al doilea contact'}: {copil.telefonSecundar}
              </a>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
