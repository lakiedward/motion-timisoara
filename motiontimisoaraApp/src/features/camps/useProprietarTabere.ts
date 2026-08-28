import { useQuery } from '@tanstack/react-query'

import { getMyClub } from '@/api/club'
import { useAuth } from '@/lib/auth-context'
import type { Proprietar } from '@/api/camps-admin'

/**
 * Cine deține taberele pe care le vede utilizatorul curent.
 *
 * O tabără e a unui club SAU a unui antrenor, niciodată a amândurora
 * (`camps_owner_ck`), iar paginile de administrare sunt aceleași pentru
 * amândoi — doar proprietarul diferă. Locul ăsta e singurul care decide care
 * din ei e, ca să nu se strecoare două răspunsuri diferite în două ecrane.
 *
 * `gata` e distinct de „nu are proprietar": cât timp clubul se încarcă nu știm
 * încă nimic, iar o listă goală arătată atunci ar fi o minciună. Aceeași
 * capcană ca la interogările oprite de `enabled`, care nu au nici `isLoading`,
 * nici `isError`.
 */
export function useProprietarTabere(): {
  proprietar: Proprietar
  gata: boolean
  eClub: boolean
  eroare: boolean
  reincearca: () => void
} {
  const { user } = useAuth()
  const eClub = user?.role === 'CLUB'

  const {
    data: club,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    enabled: eClub,
  })

  return {
    proprietar: {
      clubId: eClub ? (club?.id ?? null) : null,
      coachUserId: eClub ? null : (user?.id ?? null),
    },
    gata: eClub ? !isLoading && !isError : !!user,
    eClub,
    eroare: eClub && isError,
    reincearca: () => void refetch(),
  }
}
