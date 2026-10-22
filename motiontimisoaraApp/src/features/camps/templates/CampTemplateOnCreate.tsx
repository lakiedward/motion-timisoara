import { useQuery } from '@tanstack/react-query'

import { listeazaSabloaneTabara, type Proprietar } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CampFormField from '../CampFormField'

export default function CampTemplateOnCreate({
  proprietar,
  gata,
  activ,
  onActiv,
  nume,
  onNume,
}: {
  proprietar: Proprietar
  gata: boolean
  activ: boolean
  onActiv: (activ: boolean) => void
  nume: string
  onNume: (nume: string) => void
}) {
  const areProprietar = !!proprietar.clubId || !!proprietar.coachUserId
  const sabloane = useQuery({
    queryKey: ['sabloane-tabara', proprietar.clubId, proprietar.coachUserId] as const,
    queryFn: () => listeazaSabloaneTabara(proprietar),
    enabled: gata && areProprietar && activ,
  })
  if (!areProprietar) return null
  const inlocuieste = (sabloane.data ?? []).some((s) => s.name === nume.trim())

  return (
    <div className="bg-card space-y-3 rounded-xl border p-4">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4"
          checked={activ}
          onChange={(e) => onActiv(e.target.checked)}
        />
        Salvează și ca șablon
      </label>
      {activ && (
        <CampFormField
          eticheta="Numele șablonului"
          ajutor={
            inlocuieste
              ? `Înlocuiește șablonul „${nume.trim()}” pe care îl ai deja.`
              : 'Data viitoare pornești de la el: necesarul, regulamentul și prețurile vin completate.'
          }
        >
          <Input value={nume} maxLength={120} onChange={(e) => onNume(e.target.value)} />
        </CampFormField>
      )}
      {activ && sabloane.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm">
            Nu am putut verifica șabloanele pe care le ai. Dacă numele există deja, șablonul vechi
            se înlocuiește.
          </p>
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
    </div>
  )
}
