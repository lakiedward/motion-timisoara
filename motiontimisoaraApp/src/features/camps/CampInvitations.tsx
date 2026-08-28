import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { getInvitatiileMele, raspundeInvitatie } from '@/api/camp-coaches'
import { formatZi } from '@/api/camps'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Invitațiile antrenorului la tabere.
 *
 * Stă deasupra taberelor proprii, fiindcă e singurul lucru de aici care așteaptă
 * o decizie de la el. Se ascunde cu totul când n-are niciuna: un titlu peste o
 * listă goală ar fi o promisiune neonorată pe fiecare vizită.
 */
export default function CampInvitations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const {
    data: invitatii = [],
    isError,
    refetch,
  } = useQuery({
    queryKey: ['invitatiile-mele', user?.id],
    queryFn: () => getInvitatiileMele(user!.id),
    enabled: !!user?.id,
  })

  const raspunde = useMutation({
    mutationFn: ({ campId, accept }: { campId: string; accept: boolean }) =>
      raspundeInvitatie(campId, accept),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? 'Ai acceptat. Apari acum pe pagina taberei.' : 'Ai refuzat invitația.')
      qc.invalidateQueries({ queryKey: ['invitatiile-mele'] })
    },
    onError: () => toast.error('Nu am putut trimite răspunsul.'),
  })

  if (isError) {
    return (
      <div className="mb-6 rounded-2xl border p-4" role="alert">
        <p className="text-foreground text-sm font-medium">Nu am putut încărca invitațiile.</p>
        <Button type="button" className="mt-2 h-11 min-h-11" onClick={() => void refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }

  const deRaspuns = invitatii.filter((i) => i.stare === 'invited')
  const acceptate = invitatii.filter((i) => i.stare === 'accepted')
  if (!deRaspuns.length && !acceptate.length) return null

  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold">Tabere la care ești invitat</h2>
      <ul className="mt-3 space-y-3">
        {[...deRaspuns, ...acceptate].map((i) => (
          <li key={i.campId} className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to={`/tabere/${i.slug}`} className="font-medium hover:underline">
                  {i.titlu}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatZi(i.perioadaStart)} – {formatZi(i.perioadaEnd)}
                  {i.loc ? ` · ${i.loc}` : ''}
                </p>
              </div>
              {i.stare === 'accepted' && <Badge>Ai acceptat</Badge>}
            </div>

            {/* Cine pleacă cu copiii trebuie să ajungă la lista lor — cu alergii
                și contacte de urgență. Politica din bază îl lasă (00028, 00032),
                deci linkul nu deschide nimic ce n-avea deja voie să vadă. */}
            {i.stare === 'accepted' && (
              <Link
                to={`/coach/camps/${i.campId}/enrolled`}
                className="text-muted-foreground hover:text-foreground mt-2 inline-flex h-11 items-center text-sm"
              >
                Vezi cine s-a înscris
              </Link>
            )}

            {i.stare === 'invited' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-11 min-h-11"
                  disabled={raspunde.isPending}
                  onClick={() => raspunde.mutate({ campId: i.campId, accept: true })}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-11"
                  disabled={raspunde.isPending}
                  onClick={() => raspunde.mutate({ campId: i.campId, accept: false })}
                >
                  Refuz
                </Button>
                <p className="text-muted-foreground w-full text-xs">
                  Numele și poza ta apar pe pagina publică a taberei doar dacă accepți.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
