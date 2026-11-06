import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  confirmCompetitionCashPayment,
  getCompetitionCashPayments,
} from '@/api/competition/competition-cash'
import { formatMoney } from '@/lib/money'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function CompetitionCashPaymentsSection({ competitionId }: { competitionId: string }) {
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const payments = useQuery({
    queryKey: ['competition-cash-payments', competitionId],
    queryFn: () => getCompetitionCashPayments(competitionId),
  })
  const confirm = useMutation({
    mutationFn: confirmCompetitionCashPayment,
    onSuccess: () => {
      setConfirmId(null)
      toast.success('Încasarea cash a fost confirmată.')
      void queryClient.invalidateQueries({ queryKey: ['competition-cash-payments', competitionId] })
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (error: Error) => toast.error(error.message || 'Nu am putut confirma încasarea.'),
  })

  return (
    <FormSection
      title="Plăți cash"
      description="Confirmă plata numai după ce ai încasat suma de la participant sau părinte."
    >
      {payments.isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : payments.isError ? (
        <div role="alert" className="space-y-2">
          <p>Nu am putut încărca plățile cash.</p>
          <Button type="button" variant="outline" onClick={() => void payments.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : payments.data?.length ? (
        <ul className="space-y-3">
          {payments.data.map((payment) => (
            <li
              key={payment.payment_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {payment.participant_name} · {payment.category_name}
                </p>
                <p className="text-muted-foreground mt-1">
                  {formatMoney(payment.amount, payment.currency)} ·{' '}
                  {payment.status === 'SUCCEEDED' ? 'Confirmată' : 'În așteptare'}
                </p>
              </div>
              {payment.status === 'PENDING' && (
                <Button
                  type="button"
                  variant={confirmId === payment.payment_id ? 'default' : 'outline'}
                  className="min-h-touch-target"
                  disabled={confirm.isPending}
                  onClick={() =>
                    confirmId === payment.payment_id
                      ? confirm.mutate(payment.payment_id)
                      : setConfirmId(payment.payment_id)
                  }
                >
                  {confirmId === payment.payment_id
                    ? 'Confirmă suma încasată'
                    : 'Confirmă încasarea'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nu există încă plăți cash pentru acest concurs.
        </p>
      )}
    </FormSection>
  )
}
