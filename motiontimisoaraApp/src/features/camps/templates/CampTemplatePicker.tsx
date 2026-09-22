import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  listeazaSabloaneTabara,
  stergeSablonTabara,
  type Proprietar,
  type SablonTabara,
} from '@/api/camps-admin'
import { Button } from '@/components/ui/button'

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

  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-lg font-bold">Pornește de la un șablon</legend>
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
        <div className="space-y-2" role="radiogroup" aria-label="Pornește de la un șablon">
          {(sabloane.data ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nu ai șabloane. Le salvezi dintr-o tabără existentă, cu „Salvează ca șablon”.
            </p>
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="radio"
              name="sablon-tabara"
              className="size-4"
              checked={selectatId === ''}
              onChange={() => aplica(null)}
            />
            Formular gol
          </label>
          {(sabloane.data ?? []).map((sablon) => (
            <div key={sablon.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex min-h-11 min-w-0 items-center gap-3 text-sm sm:flex-1">
                <input
                  type="radio"
                  name="sablon-tabara"
                  className="size-4 shrink-0"
                  checked={selectatId === sablon.id}
                  onChange={() => aplica(sablon)}
                />
                <span className="truncate">{sablon.name}</span>
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 sm:w-auto"
                aria-label={`Șterge ${sablon.name}`}
                onClick={() => {
                  setAsteptare(null)
                  setDeSters(sablon)
                }}
              >
                Șterge
              </Button>
            </div>
          ))}
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
          <p className="text-sm">
            Ștergi șablonul „{deSters.name}”? Taberele create din el rămân.
          </p>
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
    </fieldset>
  )
}
