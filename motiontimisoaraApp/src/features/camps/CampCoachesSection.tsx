import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  cautaAntrenori,
  getAntrenoriiTaberei,
  invitaAntrenor,
  retrageInvitatia,
  type AntrenorInvitat,
} from '@/api/camp-coaches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const STARE: Record<AntrenorInvitat['stare'], { text: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  accepted: { text: 'A acceptat', variant: 'default' },
  invited: { text: 'Așteaptă răspuns', variant: 'secondary' },
  declined: { text: 'A refuzat', variant: 'destructive' },
}

export default function CampCoachesSection({ campId }: { campId: string }) {
  const qc = useQueryClient()
  const [cautare, setCautare] = useState('')

  const {
    data: antrenori = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['antrenorii-taberei', campId],
    queryFn: () => getAntrenoriiTaberei(campId),
  })

  const deja = antrenori.map((a) => a.coachProfileId)
  const { data: gasiti = [], isFetching: seCauta } = useQuery({
    queryKey: ['cauta-antrenori', cautare, deja.join(',')],
    queryFn: () => cautaAntrenori(cautare, deja),
    enabled: cautare.trim().length >= 2,
  })

  const reimprospateaza = () => {
    qc.invalidateQueries({ queryKey: ['antrenorii-taberei', campId] })
    qc.invalidateQueries({ queryKey: ['taberele-mele'] })
  }

  const invita = useMutation({
    mutationFn: (coachProfileId: string) => invitaAntrenor(campId, coachProfileId),
    onSuccess: () => {
      toast.success('Invitație trimisă. Apare pe pagină după ce acceptă.')
      setCautare('')
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut trimite invitația.'),
  })

  const retrage = useMutation({
    mutationFn: (coachProfileId: string) => retrageInvitatia(campId, coachProfileId),
    onSuccess: () => {
      toast.success('Invitație retrasă.')
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut retrage invitația.'),
  })

  return (
    <fieldset className="rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Antrenorii care însoțesc</legend>

      <p className="text-muted-foreground text-sm">
        Poți invita orice antrenor, dar apare pe pagina publică abia după ce acceptă. Până atunci
        vezi invitația doar tu.
      </p>

      {isError ? (
        <div className="mt-4" role="alert">
          <p className="text-foreground text-sm font-medium">Nu am putut încărca antrenorii.</p>
          <Button type="button" className="mt-2 h-11 min-h-11" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground mt-4 text-sm">Se încarcă…</p>
      ) : (
        <>
          {antrenori.length > 0 && (
            <ul className="mt-4 space-y-2">
              {antrenori.map((a) => (
                <li
                  key={a.coachProfileId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  {a.pozaUrl ? (
                    <img src={a.pozaUrl} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                      {a.nume.charAt(0)}
                    </span>
                  )}
                  <span className="flex-1 font-medium">{a.nume}</span>
                  <Badge variant={STARE[a.stare].variant}>
                    {a.stare === 'invited' && <Clock className="mr-1 size-3" />}
                    {a.stare === 'accepted' && <Check className="mr-1 size-3" />}
                    {STARE[a.stare].text}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-11 min-h-11"
                    disabled={retrage.isPending}
                    onClick={() => retrage.mutate(a.coachProfileId)}
                    aria-label={`Scoate-l pe ${a.nume} din tabără`}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Label className="mb-1.5 block">Caută un antrenor</Label>
            <Input
              value={cautare}
              onChange={(e) => setCautare(e.target.value)}
              placeholder="Scrie cel puțin două litere din nume"
              className="h-11 lg:h-9"
            />
          </div>

          {cautare.trim().length >= 2 && (
            <div className="mt-3">
              {seCauta ? (
                <p className="text-muted-foreground text-sm">Caut…</p>
              ) : gasiti.length === 0 ? (
                // Starea goală spune DE CE e goală: „niciun rezultat" și „i-ai
                // invitat deja pe toți cei găsiți" arată la fel altfel.
                <p className="text-muted-foreground text-sm">
                  Niciun antrenor nou cu numele ăsta. Cei deja invitați nu apar aici.
                </p>
              ) : (
                <ul className="space-y-2">
                  {gasiti.map((g) => (
                    <li
                      key={g.coachProfileId}
                      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                    >
                      {g.pozaUrl ? (
                        <img src={g.pozaUrl} alt="" className="size-10 rounded-full object-cover" />
                      ) : (
                        <span className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                          {g.nume.charAt(0)}
                        </span>
                      )}
                      <span className="flex-1 font-medium">{g.nume}</span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-h-11"
                        disabled={invita.isPending}
                        onClick={() => invita.mutate(g.coachProfileId)}
                      >
                        <UserPlus className="size-4" /> Invită
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  )
}
