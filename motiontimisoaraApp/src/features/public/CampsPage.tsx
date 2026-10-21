import { useQuery } from '@tanstack/react-query'

import { getTaberePublice } from '@/api/camps'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CardTabara } from './components/CampListCard'

export default function CampsPage() {
  const {
    data: tabere = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['tabere-publice'], queryFn: () => getTaberePublice() })

  return (
    <div>
      <section
        aria-labelledby="camps-page-title"
        data-section="motion-react:page:/tabere:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Vacanțe active</span>
          <h1
            id="camps-page-title"
            className="font-display text-foreground text-4xl font-extrabold lg:text-5xl"
          >
            Tabere
          </h1>
          <p className="text-muted-foreground mt-2">Tabere sportive pentru copii.</p>
        </div>
      </section>

      <div
        data-section="motion-react:page:/tabere:section:lista-tabere"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca taberele."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă taberele" className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : tabere.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tabere.map((t) => (
              <li key={t.id}>
                <CardTabara tabara={t} />
              </li>
            ))}
          </ul>
        ) : (
          <StatusView
            state="empty"
            title="Nicio tabără programată momentan."
            text="Taberele noi apar aici când un club sau un antrenor le anunță."
          />
        )}
      </div>
    </div>
  )
}
