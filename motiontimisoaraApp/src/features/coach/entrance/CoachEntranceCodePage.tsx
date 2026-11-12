import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Download, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import {
  EntranceCodeError,
  getCoachEntranceCode,
  rotateCoachEntranceCode,
  type CoachEntranceCode,
} from '@/api/attendance/entrance'
import { BackLink, PageHeader } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { entranceUrl } from '@/lib/entrance-code'
import { formatShortDateTime } from '@/lib/panel-date'
import { POSTER_STEPS, POSTER_WINDOW, printEntrancePoster } from './entrance-poster'

const QUERY_KEY = ['coach-entrance-code']

function useQrImage(url: string | null) {
  const [drawn, setDrawn] = useState<{ url: string; image: string | null; failed: boolean } | null>(
    null,
  )
  useEffect(() => {
    if (!url) return
    let cancelled = false
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })
      .then((image) => {
        if (!cancelled) setDrawn({ url, image, failed: false })
      })
      .catch(() => {
        if (!cancelled) setDrawn({ url, image: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [url])
  const current = drawn?.url === url ? drawn : null
  return { image: current?.image ?? null, failed: current?.failed ?? false }
}

export default function CoachEntranceCodePage() {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCoachEntranceCode,
    retry: false,
  })

  const rotate = useMutation({
    mutationFn: rotateCoachEntranceCode,
    onSuccess: (code) => {
      setConfirming(false)
      qc.setQueryData<CoachEntranceCode>(QUERY_KEY, code)
      toast.success('Cod nou generat. Printează foaia nouă: cea veche nu mai funcționează.')
    },
    onError: () => toast.error('Nu am putut genera un cod nou. Reîncearcă.'),
  })

  const forbidden = error instanceof EntranceCodeError
  const url = data ? entranceUrl(window.location.origin, data.token) : null
  const { image, failed } = useQrImage(url)

  return (
    <div data-section="coach-entrance-code" className="mx-auto max-w-3xl">
      <BackLink to="/coach/attendance">Prezență</BackLink>
      <PageHeader title="Codul de la intrare" className="mt-2" />
      <p className="text-muted-foreground -mt-2 mb-6 text-sm">
        Lipește foaia la intrare. Părinții o scanează cu telefonul și își marchează singuri copilul
        prezent. Tu poți corecta oricând din catalog, iar scanarea codului copilului merge în
        continuare.
      </p>

      {isPending ? (
        <StatusView
          state="loading"
          title="Se încarcă codul de la intrare"
          rows={1}
          rowHeight={360}
        />
      ) : isError ? (
        forbidden ? (
          <StatusView
            state="empty"
            titleAs="h2"
            title="Codul de la intrare e doar pentru antrenori"
            text="Intră cu contul de antrenor ca să vezi și să printezi codul tău."
          />
        ) : (
          <StatusView
            state="error"
            title="Nu am putut încărca codul."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        )
      ) : (
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
          <div className="bg-card rounded-xl border p-5">
            <div className="bg-white mx-auto w-fit rounded-xl p-3">
              {failed ? (
                <StatusView
                  state="error"
                  title="Nu am putut desena codul."
                  text="Reîncarcă pagina și încearcă din nou."
                  className="size-64 py-6 sm:size-72"
                />
              ) : image ? (
                <img
                  src={image}
                  alt={`Codul de prezență al antrenorului ${data.coachName}`}
                  className="size-64 sm:size-72"
                />
              ) : (
                <Skeleton className="size-64 rounded-xl sm:size-72" />
              )}
            </div>
            <p className="font-display mt-4 text-center font-bold">{data.coachName}</p>
            {data.rotatedAt && (
              <p className="text-muted-foreground mt-1 text-center text-xs">
                Generat pe {formatShortDateTime(data.rotatedAt)}
              </p>
            )}
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                className="h-touch-target min-h-touch-target"
                disabled={!image}
                onClick={() => {
                  if (image && !printEntrancePoster(image, data.coachName)) {
                    toast.error('Browserul a blocat fereastra de printare. Permite ferestrele noi.')
                  }
                }}
              >
                <Printer aria-hidden="true" /> Printează foaia A4
              </Button>
              <Button asChild variant="outline" className="h-touch-target min-h-touch-target">
                <a
                  href={image ?? undefined}
                  download="cod-prezenta-intrare.png"
                  aria-disabled={!image}
                >
                  <Download aria-hidden="true" /> Salvează imaginea
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <section className="bg-card rounded-xl border p-5">
              <h2 className="font-display font-bold">Ce fac părinții</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                {POSTER_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="text-muted-foreground mt-3 text-sm">
                {POSTER_WINDOW} Merge doar la cursuri, pentru copiii înscriși la tine.
              </p>
            </section>

            <section className="rounded-xl border border-dashed p-5">
              <h2 className="font-display font-bold">Foaia a fost pierdută sau fotografiată?</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Generează un cod nou și printează foaia din nou. Codul vechi nu va mai fi
                recunoscut.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-touch-target min-h-touch-target mt-3"
                disabled={rotate.isPending}
                onClick={() => setConfirming(true)}
              >
                <RefreshCw aria-hidden="true" /> Generează un cod nou
              </Button>
            </section>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Generezi un cod nou de intrare?"
        description="Foaia lipită acum la intrare nu va mai funcționa până nu o înlocuiești cu cea nouă."
        confirmLabel="Generează"
        destructive
        pending={rotate.isPending}
        onConfirm={() => rotate.mutate()}
      />
    </div>
  )
}
