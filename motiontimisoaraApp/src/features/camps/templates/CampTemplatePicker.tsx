import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  listeazaSabloaneTabara,
  stergeSablonTabara,
  type Proprietar,
  type SablonTabara,
} from '@/api/camps-admin'
import { Trash2 } from 'lucide-react'

import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

export default function CampTemplatePicker({
  proprietar,
  gata,
  eroareProprietar = false,
  reincearcaProprietar,
  selectatId,
  citesteAreDate,
  onAlege,
  onSters,
}: {
  proprietar: Proprietar
  gata: boolean
  eroareProprietar?: boolean
  reincearcaProprietar?: () => void
  selectatId: string
  citesteAreDate: () => boolean
  onAlege: (sablon: SablonTabara | null) => void
  onSters: (id: string) => void
}) {
  const qc = useQueryClient()
  const [asteptare, setAsteptare] = useState<SablonTabara | 'gol' | null>(null)
  const [deSters, setDeSters] = useState<SablonTabara | null>(null)
  const [sterge, setSterge] = useState(false)
  const cheie = ['sabloane-tabara', proprietar.clubId, proprietar.coachUserId] as const
  const sabloane = useQuery({
    queryKey: cheie,
    queryFn: () => listeazaSabloaneTabara(proprietar),
    enabled: gata && (!!proprietar.clubId || !!proprietar.coachUserId),
  })

  const aplica = (urmatorul: SablonTabara | null) => {
    const id = urmatorul?.id ?? ''
    if (id === selectatId) return
    if (citesteAreDate()) {
      setDeSters(null)
      setAsteptare(urmatorul ?? 'gol')
      return
    }
    setAsteptare(null)
    onAlege(urmatorul)
  }

  const confirmaAlegerea = () => {
    if (asteptare === null) return
    onAlege(asteptare === 'gol' ? null : asteptare)
    setAsteptare(null)
  }

  const confirmaStergerea = async () => {
    if (!deSters) return
    setSterge(true)
    try {
      await stergeSablonTabara(deSters.id)
      if (selectatId === deSters.id) onSters(deSters.id)
      setDeSters(null)
      await qc.invalidateQueries({ queryKey: cheie })
      toast.success('Șablon șters.')
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : ''
      toast.error(mesaj || 'Nu am putut șterge șablonul.')
    } finally {
      setSterge(false)
    }
  }

  const lista = sabloane.data ?? []
  const optiune =
    'border-input has-checked:border-primary has-checked:ring-primary flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm has-checked:ring-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring'

  return (
    <FormSection
      title="Pornește de la un șablon"
      description="Alegi o tabără salvată de tine și pornești cu necesarul, regulamentul și prețurile deja completate."
    >
      {eroareProprietar || sabloane.isError ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm">Nu am putut încărca șabloanele.</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => {
              reincearcaProprietar?.()
              void sabloane.refetch()
            }}
          >
            Reîncearcă
          </Button>
        </div>
      ) : !gata || sabloane.isLoading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Se încarcă șabloanele…
        </p>
      ) : (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Pornește de la un șablon"
        >
          {lista.map((sablon) => (
            <div key={sablon.id} className="relative">
              <label className={optiune}>
                <input
                  type="radio"
                  name="sablon-tabara"
                  className="mt-0.5 size-4 shrink-0"
                  checked={selectatId === sablon.id}
                  onChange={() => aplica(sablon)}
                />
                <span className="min-w-0 flex-1 pr-10">
                  <span className="block truncate font-medium">{sablon.name}</span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {rezumatSablon(sablon)}
                  </span>
                </span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 size-11"
                aria-label={`Șterge ${sablon.name}`}
                onClick={() => {
                  setAsteptare(null)
                  setDeSters(sablon)
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <label className={optiune}>
            <input
              type="radio"
              name="sablon-tabara"
              className="mt-0.5 size-4 shrink-0"
              checked={selectatId === ''}
              onChange={() => aplica(null)}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Formular gol</span>
              <span className="text-muted-foreground mt-1 block text-xs">
                {lista.length === 0
                  ? 'Nu ai încă șabloane. După ce creezi tabăra, o poți salva ca șablon la Verificare.'
                  : 'Completezi totul de la zero.'}
              </span>
            </span>
          </label>
        </div>
      )}
      {asteptare && (
        <div className="bg-muted space-y-3 rounded-2xl p-4">
          <p className="text-sm">
            {asteptare === 'gol'
              ? 'Golești câmpurile venite din șablon? Titlul, adresa paginii și perioada rămân.'
              : 'Înlocuiești câmpurile copiate din șablon? Titlul, adresa paginii și perioada rămân.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="h-11 min-h-11" onClick={confirmaAlegerea}>
              {asteptare === 'gol' ? 'Golește' : 'Înlocuiește'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setAsteptare(null)}
            >
              Renunță
            </Button>
          </div>
        </div>
      )}
      {deSters && (
        <div className="bg-muted space-y-3 rounded-2xl p-4">
          <p className="text-sm">Ștergi șablonul „{deSters.name}”? Taberele create din el rămân.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              className="h-11 min-h-11"
              disabled={sterge}
              onClick={() => void confirmaStergerea()}
            >
              {sterge ? 'Se șterge…' : 'Șterge șablonul'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setDeSters(null)}
            >
              Renunță
            </Button>
          </div>
        </div>
      )}
    </FormSection>
  )
}

function rezumatSablon(sablon: SablonTabara): string {
  const parti: string[] = []
  if (sablon.camp_requirements.length > 0) {
    const articole = sablon.camp_requirements.reduce((n, c) => n + c.items.length, 0)
    parti.push(plural(articole, 'articol de necesar', 'articole de necesar'))
  }
  if (sablon.age_prices.length > 0) {
    parti.push(plural(sablon.age_prices.length, 'categorie de vârstă', 'categorii de vârstă'))
  }
  if (sablon.rules?.trim()) parti.push('regulament')
  if (sablon.location_text?.trim()) parti.push(sablon.location_text.trim())
  return parti.length > 0 ? parti.join(' · ') : 'Fără detalii salvate'
}
