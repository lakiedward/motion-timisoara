import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { CircleCheck, Info } from 'lucide-react'

import { NoticeRow } from '@/features/billing/StripeNotice'

export const CHECKOUT_RETURN_PARAM = 'abonament'

const REFRESH_DELAYS_MS = [0, 2000, 5000, 10000, 20000]

type Outcome = 'reusit' | 'anulat'

function readOutcome(value: string | null): Outcome | null {
  return value === 'reusit' || value === 'anulat' ? value : null
}

export function CheckoutReturnNotice({ queryKeys }: { queryKeys: QueryKey[] }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [outcome] = useState(() => readOutcome(params.get(CHECKOUT_RETURN_PARAM)))
  const keysJson = JSON.stringify(queryKeys)

  useEffect(() => {
    if (!params.has(CHECKOUT_RETURN_PARAM) && !params.has('session_id')) return
    const next = new URLSearchParams(params)
    next.delete(CHECKOUT_RETURN_PARAM)
    next.delete('session_id')
    setParams(next, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    if (outcome !== 'reusit') return
    const timers = REFRESH_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        for (const queryKey of JSON.parse(keysJson) as QueryKey[]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      }, delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [outcome, queryClient, keysJson])

  if (outcome === 'reusit') {
    return (
      <NoticeRow
        role="status"
        tone="success"
        icon={
          <CircleCheck aria-hidden="true" className="text-success-ink mt-0.5 size-5 shrink-0" />
        }
      >
        <p className="font-semibold" data-testid="checkout-return-success">
          Mulțumim! Plata abonamentului a fost trimisă.
        </p>
        <p className="text-muted-foreground">
          Stripe ne confirmă plata în câteva secunde, iar pagina se actualizează singură.
        </p>
      </NoticeRow>
    )
  }
  if (outcome === 'anulat') {
    return (
      <NoticeRow
        role="status"
        icon={<Info aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
      >
        <p className="font-semibold" data-testid="checkout-return-canceled">
          Ai închis plata înainte de final.
        </p>
        <p className="text-muted-foreground">Nu am încasat nimic. Poți alege pachetul oricând.</p>
      </NoticeRow>
    )
  }
  return null
}
