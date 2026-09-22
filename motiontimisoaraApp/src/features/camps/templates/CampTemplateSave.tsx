import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  listeazaSabloaneTabara,
  salveazaSablonTabara,
  type Proprietar,
  type SablonDeSalvat,
} from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CampFormField from '../CampFormField'

export default function CampTemplateSave({
  proprietar,
  gata,
  numeImplicit,
  pregateste,
}: {
  proprietar: Proprietar
  gata: boolean
  numeImplicit: string
  pregateste: (nume: string) => Promise<SablonDeSalvat | null>
}) {
  const qc = useQueryClient()
  const [numeEditat, setNumeEditat] = useState<string | null>(null)
  const nume = numeEditat ?? numeImplicit
  const [eroare, setEroare] = useState<string | null>(null)
  const [confirma, setConfirma] = useState(false)
  const [salveaza, setSalveaza] = useState(false)
  const cheie = ['sabloane-tabara', proprietar.clubId, proprietar.coachUserId] as const
  const sabloane = useQuery({
    queryKey: cheie,
    queryFn: () => listeazaSabloaneTabara(proprietar),
    enabled: gata && (!!proprietar.clubId || !!proprietar.coachUserId),
  })

  const scrie = async (inlocuieste: boolean) => {
    const pregatit = await pregateste(nume)
    if (!pregatit) return
    let lista = sabloane.data
    if (!lista) {
      const rezultat = await sabloane.refetch()
      if (rezultat.error || !rezultat.data) {
        toast.error('Nu am putut verifica șabloanele existente.')
        return
      }
      lista = rezultat.data
    }
    const exista = lista.some((sablon) => sablon.name === pregatit.name)
    if (exista && !inlocuieste) {
      setConfirma(true)
      return
    }
    setSalveaza(true)
    try {
      await salveazaSablonTabara(proprietar, pregatit)
      setConfirma(false)
      await qc.invalidateQueries({ queryKey: cheie })
      toast.success('Șablon salvat.')
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : ''
      toast.error(mesaj || 'Nu am putut salva șablonul.')
    } finally {
      setSalveaza(false)
    }
  }

  return (
    <section className="mb-6 space-y-3" aria-labelledby="salveaza-sablon">
      <h2 id="salveaza-sablon" className="font-display text-lg font-bold">
        Șablon
      </h2>
      <p className="text-muted-foreground text-sm">
        Salvează configurația de acum. Titlul, adresa paginii și perioada nu intră în șablon.
      </p>
      {sabloane.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm">Nu am putut încărca șabloanele.</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => void sabloane.refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      )}
      <CampFormField eticheta="Numele șablonului" eroare={eroare ?? undefined}>
        <Input
          value={nume}
          className="h-11 lg:h-9"
          aria-invalid={!!eroare}
          onChange={(event) => {
            setNumeEditat(event.target.value)
            setEroare(null)
            setConfirma(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
        />
      </CampFormField>
      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11"
        disabled={salveaza}
        onClick={() => {
          const numeCurat = nume.trim()
          if (numeCurat.length < 1 || numeCurat.length > 120) {
            setEroare(
              numeCurat.length > 120
                ? 'Numele poate avea cel mult 120 de caractere'
                : 'Numele șablonului lipsește',
            )
            return
          }
          setEroare(null)
          void scrie(false)
        }}
      >
        {salveaza ? 'Se salvează…' : 'Salvează ca șablon'}
      </Button>
      {confirma && (
        <div className="bg-muted space-y-3 rounded-2xl p-4">
          <p className="text-sm">Există deja un șablon cu acest nume. Îl înlocuiești?</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="h-11 min-h-11"
              disabled={salveaza}
              onClick={() => void scrie(true)}
            >
              Înlocuiește
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setConfirma(false)}
            >
              Renunță
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
