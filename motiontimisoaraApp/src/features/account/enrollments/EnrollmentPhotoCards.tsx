import { useState } from 'react'
import { UserRound } from 'lucide-react'

import type { EnrollmentRow } from '@/api/account'
import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'
import { cn } from '@/lib/utils'
import { KIND_LABEL, byAttention, needsPayment, participantName } from './enrollment-display'
import {
  CARD,
  CardTitle,
  EnrolledOn,
  LINKED,
  PayButton,
  PayPanel,
  PaymentSummary,
  SessionsLeft,
  StatusBadge,
  WhenLine,
} from './EnrollmentParts'

function OfferPhoto({ src, sportCode }: { src: string | null; sportCode: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <SportIllustration code={sportCode} compact />
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  )
}

type Props = {
  enrollments: EnrollmentRow[]
  paymentId: string | null
  setPaymentId: (id: string | null) => void
}

export function EnrollmentPhotoCards({ enrollments, paymentId, setPaymentId }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {byAttention(enrollments).map((e) => {
        const titleId = `inscriere-${e.id}`
        const person = participantName(e)
        return (
          <article
            key={e.id}
            aria-labelledby={titleId}
            className={cn(
              CARD,
              'flex flex-col overflow-hidden',
              e.offerPath && LINKED,
              needsPayment(e) && 'border-primary',
            )}
          >
            <div className="relative h-32 shrink-0 overflow-hidden">
              <OfferPhoto src={e.offer?.imageUrl ?? null} sportCode={e.offer?.sportCode ?? null} />
              <Badge className="absolute top-3 left-3">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <CardTitle e={e} id={titleId} />
                <StatusBadge e={e} />
              </div>
              {person && (
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <UserRound aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                  {person}
                </p>
              )}
              {e.competition_registration && (
                <p className="text-muted-foreground text-sm">
                  {e.competition_registration.category_name_snapshot} ·{' '}
                  {e.competition_registration.route_name_snapshot}
                </p>
              )}
              <WhenLine e={e} />
              <SessionsLeft e={e} />
              <div className="mt-auto space-y-1 border-t pt-4">
                <PaymentSummary e={e} />
                <EnrolledOn e={e} />
              </div>
              {paymentId === e.id ? (
                <PayPanel e={e} onClose={() => setPaymentId(null)} />
              ) : (
                <PayButton e={e} onOpen={() => setPaymentId(e.id)} className="mt-2 w-full" />
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
