import { useId, useState } from 'react'
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
import { FormSection } from '@/components/FormSection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CoachAvatar } from './CoachAvatar'

const STARE: Record<
  AntrenorInvitat['stare'],
  { text: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  accepted: { text: 'A acceptat', variant: 'default' },
  invited: { text: 'Așteaptă răspuns', variant: 'secondary' },
  declined: { text: 'A refuzat', variant: 'destructive' },
}

export default function CampCoachesSection({ campId }: { campId: string }) {
  const qc = useQueryClient()
  const idCautare = useId()
  const [cautare, setCautare] = useState('')
  const [deScos, setDeScos] = useState<AntrenorInvitat | null>(null)

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
  const cautareActiva = cautare.trim().length >= 2
  const gasiti = useQuery({
    queryKey: ['cauta-antrenori', cautare, deja.join(',')],
    queryFn: () => cautaAntrenori(cautare, deja),
    enabled: cautareActiva,
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
      toast.success('Antrenorul nu mai e în tabără.')
      setDeScos(null)
      reimprospateaza()
    },
    onError: () => toast.error('Nu am putut scoate antrenorul. Încearcă din nou.'),
  })

  const rand = (a: AntrenorInvitat) => (
    <li key={a.coachProfileId} className="flex items-center gap-3 rounded-xl border p-3">
      <CoachAvatar nume={a.nume} pozaUrl={a.pozaUrl} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium break-words">{a.nume}</p>
        <Badge variant={STARE[a.stare].variant}>
          {a.stare === 'invited' && <Clock className="size-3" />}
          {a.stare === 'accepted' && <Check className="size-3" />}
          {STARE[a.stare].text}
        </Badge>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="size-11 shrink-0"
        onClick={() => setDeScos(a)}
        aria-label={`Scoate ${a.nume} din tabără`}
      >
        <X className="size-4" />
      </Button>
    </li>
  )

  const lista =
    antrenori.length === 0 ? (
      <p className="text-muted-foreground text-sm">
        Nu ai invitat încă niciun antrenor. Caută-l după nume mai jos.
      </p>
    ) : (
      <ul className="space-y-2">{antrenori.map(rand)}</ul>
    )

  const rezultate = !cautareActiva ? null : gasiti.isError ? (
    <div className="space-y-2" role="alert">
      <p className="text-sm">Nu am putut căuta antrenorii.</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 min-h-11"
        onClick={() => void gasiti.refetch()}
      >
        Reîncearcă
      </Button>
    </div>
  ) : gasiti.isFetching ? (
    <p className="text-muted-foreground text-sm">Caut…</p>
  ) : (gasiti.data ?? []).length === 0 ? (
    <p className="text-muted-foreground text-sm">
      Niciun antrenor nou cu numele ăsta. Cei deja invitați nu apar aici.
    </p>
  ) : (
    <ul className="space-y-2">
      {(gasiti.data ?? []).map((g) => (
        <li key={g.coachProfileId} className="flex items-center gap-3 rounded-xl border p-3">
          <CoachAvatar nume={g.nume} pozaUrl={g.pozaUrl} />
          <span className="min-w-0 flex-1 font-medium break-words">{g.nume}</span>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 shrink-0"
            disabled={invita.isPending}
            onClick={() => invita.mutate(g.coachProfileId)}
          >
            <UserPlus className="size-4" /> Invită
          </Button>
        </li>
      ))}
    </ul>
  )

  return (
    <FormSection
      title="Antrenorii care însoțesc"
      description="Poți invita orice antrenor. Apare pe pagina publică abia după ce acceptă; până atunci invitația o vezi doar tu."
    >
      {isError ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm font-medium">Nu am putut încărca antrenorii.</p>
          <Button type="button" className="h-11 min-h-11" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground text-sm">Se încarcă antrenorii…</p>
      ) : (
        <>
          {lista}
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor={idCautare} className="mb-1.5">
                Invită un antrenor
              </Label>
              <Input
                id={idCautare}
                value={cautare}
                onChange={(e) => setCautare(e.target.value)}
                placeholder="Minim două litere din nume"
              />
            </div>
            {rezultate}
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!deScos}
        onOpenChange={(open) => !open && setDeScos(null)}
        title={`Scoți ${deScos?.nume ?? ''} din tabără?`}
        description={
          deScos?.stare === 'accepted'
            ? 'Dispare de pe pagina publică a taberei. Dacă te răzgândești, trebuie să-l inviți din nou.'
            : 'Invitația se retrage. Dacă te răzgândești, trebuie să-l inviți din nou.'
        }
        confirmLabel="Scoate din tabără"
        destructive
        pending={retrage.isPending}
        onConfirm={() => deScos && retrage.mutate(deScos.coachProfileId)}
      />
    </FormSection>
  )
}
