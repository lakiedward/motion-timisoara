import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck } from 'lucide-react'

import {
  entranceCheckin,
  getEntranceCheckinOptions,
  type EntranceCheckinResult,
} from '@/api/attendance/entrance'
import { PageHeader } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { isEntranceToken } from '@/lib/entrance-code'
import { checkinProblem, optionKey, optionsProblem, remainingText } from './entrance-messages'
import { EntranceOptionList } from './EntranceOptionList'

type Outcome = Extract<EntranceCheckinResult, { success: true }>

function Recorded({ result }: { result: Outcome }) {
  const remaining = remainingText(result.remainingSessions)
  return (
    <div role="status" className="border-success/40 bg-success/10 flex gap-3 rounded-xl border p-4">
      <CircleCheck aria-hidden="true" className="text-success-ink mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold wrap-anywhere">
          {result.outcome === 'recorded'
            ? `Prezență salvată pentru ${result.childName}`
            : `Prezența era deja salvată pentru ${result.childName}`}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.courseName}.{' '}
          {result.outcome === 'recorded' ? remaining : 'Nu s-a mai consumat nicio ședință.'}
        </p>
      </div>
    </div>
  )
}

function Refused({ code }: { code: string }) {
  const message = checkinProblem(code)
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 flex gap-3 rounded-xl border p-4"
    >
      <CircleAlert aria-hidden="true" className="text-destructive mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{message.title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{message.text}</p>
      </div>
    </div>
  )
}

export default function EntranceCheckinPage() {
  const { token = '' } = useParams()
  const validToken = isEntranceToken(token)
  const qc = useQueryClient()
  const [picked, setPicked] = useState<string | null>(null)
  const [last, setLast] = useState<EntranceCheckinResult | null>(null)
  const requestIds = useRef(new Map<string, string>())

  const options = useQuery({
    queryKey: ['entrance-options', token],
    queryFn: () => getEntranceCheckinOptions(token),
    enabled: validToken,
    retry: false,
  })

  const checkin = useMutation({
    mutationFn: (key: string) => {
      const option = options.data?.success
        ? options.data.options.find((o) => optionKey(o) === key)
        : undefined
      if (!option) throw new Error('missing option')
      const requestId = requestIds.current.get(key) ?? crypto.randomUUID()
      requestIds.current.set(key, requestId)
      return entranceCheckin({
        token,
        occurrenceId: option.occurrenceId,
        childId: option.childId,
        requestId,
      })
    },
    onSuccess: (result, key) => {
      requestIds.current.delete(key)
      setLast(result)
      setPicked(null)
      void qc.invalidateQueries({ queryKey: ['entrance-options', token] })
      void qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  const list = options.data?.success ? options.data.options : []
  const available = list.filter((o) => o.state === 'AVAILABLE')
  const onlyOne = available.length === 1 ? optionKey(available[0]) : null
  const selected = picked && available.some((o) => optionKey(o) === picked) ? picked : onlyOne
  const coachName = options.data?.coachName ?? null

  let body
  if (!validToken) {
    const message = optionsProblem('INVALID_CODE', null, null, null)
    body = <StatusView state="error" titleAs="h2" title={message.title} text={message.text} />
  } else if (options.isPending) {
    body = <StatusView state="loading" title="Se verifică ședințele" rows={2} rowHeight={96} />
  } else if (options.isError) {
    body = (
      <StatusView
        state="error"
        titleAs="h2"
        title="Nu am putut verifica ședințele."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void options.refetch()}
        retrying={options.isRefetching}
      />
    )
  } else if (!options.data.success) {
    const { code, nextOpensAt, serverTime } = options.data
    const message = optionsProblem(code, coachName, nextOpensAt, serverTime)
    body = (
      <StatusView
        state={code === 'OUTSIDE_WINDOW' || code === 'NOT_ENROLLED' ? 'empty' : 'error'}
        titleAs="h2"
        title={message.title}
        text={message.text}
        onRetry={
          code === 'INVALID_CODE' || code === 'FORBIDDEN' ? undefined : () => void options.refetch()
        }
        action={
          code === 'OUTSIDE_WINDOW' ? (
            <Button
              type="button"
              variant="outline"
              className="h-touch-target min-h-touch-target mt-3"
              disabled={options.isRefetching}
              onClick={() => void options.refetch()}
            >
              Verifică din nou
            </Button>
          ) : code === 'NOT_ENROLLED' ? (
            <Button asChild variant="outline" className="h-touch-target min-h-touch-target mt-3">
              <Link to="/account/enrollments">Vezi înscrierile</Link>
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    body = (
      <div className="space-y-4">
        {available.length > 1 && (
          <p className="text-sm">Alege copilul și ședința, apoi marchează prezența.</p>
        )}
        {available.length === 0 && !last && (
          <p className="text-muted-foreground text-sm">
            Nu mai e nimic de marcat acum. Vezi mai jos starea fiecărui copil.
          </p>
        )}
        <EntranceOptionList
          options={list}
          selected={selected}
          disabled={checkin.isPending}
          onSelect={setPicked}
        />
        {checkin.isError && (
          <StatusView
            state="error"
            title="Prezența nu a ajuns la server."
            text="Verifică conexiunea și apasă din nou. Nu se consumă de două ori."
            className="py-6"
          />
        )}
        {available.length > 0 ? (
          <Button
            type="button"
            className="h-touch-target min-h-touch-target w-full sm:w-auto"
            disabled={!selected || checkin.isPending}
            onClick={() => selected && checkin.mutate(selected)}
          >
            {checkin.isPending ? 'Se salvează…' : 'Marchează prezent'}
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            className="h-touch-target min-h-touch-target w-full sm:w-auto"
          >
            <Link to="/account/attendance">Vezi prezența</Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div data-section="entrance-checkin" className="mx-auto max-w-2xl">
      <PageHeader title="Prezența la intrare" className="mb-1" />
      <p className="text-muted-foreground mb-6 text-sm">
        {coachName ? `Codul antrenorului ${coachName}` : 'Codul de la intrarea în bazin sau sală'}
      </p>
      {last && (
        <div className="mb-4">
          {last.success ? <Recorded result={last} /> : <Refused code={last.code} />}
        </div>
      )}
      {body}
    </div>
  )
}
