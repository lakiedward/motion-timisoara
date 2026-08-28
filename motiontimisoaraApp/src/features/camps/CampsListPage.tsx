import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users, Images, ReceiptText, Clock } from 'lucide-react'

import { getTaberelemele, type TabaraDinLista } from '@/api/camps-admin'
import { formatZi, sAIncheiat } from '@/api/camps'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProprietarTabere } from './useProprietarTabere'

/** Aceeași pagină pentru club și pentru antrenor; diferă doar prefixul rutei. */
export default function CampsListPage({ baza }: { baza: '/club/camps' | '/coach/camps' }) {
  const { proprietar, gata, eroare, reincearca } = useProprietarTabere()

  const {
    data: tabere = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['taberele-mele', proprietar.clubId, proprietar.coachUserId],
    queryFn: () => getTaberelemele(proprietar),
    enabled: gata,
  })

  // Eroarea de la club și cea de la tabere sunt două lucruri diferite, dar
  // pentru om înseamnă același „nu s-a putut încărca". Ce NU trebuie e să cadă
  // pe starea goală: „n-ai nicio tabără" e o afirmație, nu o scuză.
  if (eroare || isError) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca taberele.</p>
        <Button
          className="mt-4 h-11 min-h-11"
          type="button"
          onClick={() => (eroare ? reincearca() : refetch())}
        >
          Reîncearcă
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Tabere</h1>
        <Button asChild className="h-11 min-h-11">
          <Link to={`${baza}/new`}>
            <Plus className="size-4" /> Tabără nouă
          </Link>
        </Button>
      </div>

      {!gata || isLoading ? (
        <p className="text-muted-foreground mt-8 text-sm">Se încarcă…</p>
      ) : tabere.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-8 text-center">
          <p className="text-foreground font-medium">Nicio tabără încă.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Prima tabără are nevoie de titlu, perioadă și preț. Categoriile, antrenorii și pozele se
            adaugă după.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {tabere.map((t) => (
            <li key={t.id}>
              <CardTabara tabara={t} baza={baza} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CardTabara({ tabara, baza }: { tabara: TabaraDinLista; baza: string }) {
  const incheiata = sAIncheiat(tabara.period_end)
  const plina = tabara.capacity !== null && tabara.locuriOcupate >= tabara.capacity
  // Prețul fără nicio categorie nu e o greșeală — dar o desfășurare pe jumătate
  // scrisă e, iar poarta din bază o refuză la salvare, deci n-ar trebui să existe.
  const faraDesfasurare = tabara.categorii === 0

  return (
    <Link
      to={`${baza}/${tabara.id}/edit`}
      className="focus-visible:ring-ring/50 block h-full rounded-2xl border p-5 outline-none transition-colors hover:border-foreground/20 focus-visible:ring-[3px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{tabara.title}</h2>
        {incheiata ? (
          <Badge variant="secondary">Încheiată</Badge>
        ) : plina ? (
          <Badge variant="destructive">Locuri epuizate</Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-2 text-sm">
        {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
        {tabara.location_text ? ` · ${tabara.location_text}` : ''}
      </p>

      <p className="mt-3 font-semibold">{formatRon(tabara.price)}</p>

      <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li className="inline-flex items-center gap-1">
          <Users className="size-4" />
          {tabara.capacity === null
            ? plural(tabara.locuriOcupate, 'înscris', 'înscriși')
            : `${tabara.locuriOcupate} din ${plural(tabara.capacity, 'loc', 'locuri')}`}
        </li>
        <li className="inline-flex items-center gap-1">
          <ReceiptText className="size-4" />
          {faraDesfasurare ? 'Fără categorii' : plural(tabara.categorii, 'categorie', 'categorii')}
        </li>
        <li className="inline-flex items-center gap-1">
          <Images className="size-4" />
          {plural(tabara.antrenoriAcceptati, 'antrenor', 'antrenori')}
        </li>
        {tabara.antrenoriInAsteptare > 0 && (
          <li className="inline-flex items-center gap-1">
            <Clock className="size-4" />
            {plural(tabara.antrenoriInAsteptare, 'invitație în așteptare', 'invitații în așteptare')}
          </li>
        )}
      </ul>
    </Link>
  )
}
