import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getConcursuriPublice, type PublicCompetition } from '@/api/competition/competitions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompetitionDateTime } from '@/lib/competition-schedule'

export default function CompetitionsPage() {
  const {
    data: concursuri = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['concursuri-publice'], queryFn: getConcursuriPublice })

  return (
    <div>
      <section className="from-primary/8 to-page border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Întreceri</span>
          <h1 className="font-display text-foreground text-4xl font-extrabold lg:text-5xl">
            Concursuri
          </h1>
          <p className="text-muted-foreground mt-2">Concursuri sportive pentru copii și adulți.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <div className="rounded-3xl border border-dashed py-20 text-center" role="alert">
            <p className="text-foreground font-medium">Nu am putut încărca concursurile.</p>
            <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
              Reîncearcă
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-7 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : concursuri.length ? (
          <div className="grid gap-7 md:grid-cols-2">
            {concursuri.map((concurs) => (
              <CardConcurs key={concurs.id} concurs={concurs} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Niciun concurs publicat momentan.
          </div>
        )}
      </div>
    </div>
  )
}

function CardConcurs({ concurs }: { concurs: PublicCompetition }) {
  return (
    <article className="bg-card shadow-card hover:shadow-card-hover relative flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1">
      {concurs.heroUrl && (
        <img src={concurs.heroUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-foreground text-xl font-bold">
          <Link
            to={`/concursuri/${concurs.slug}`}
            className="rounded-md after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {concurs.title}
          </Link>
        </h2>
        <p className="text-muted-foreground mt-3 line-clamp-3 text-sm">{concurs.description}</p>
        {concurs.startAt && (
          <p className="text-muted-foreground mt-3 text-sm">
            {formatCompetitionDateTime(concurs.startAt)}
            {concurs.locationText ? ` · ${concurs.locationText}` : ''}
          </p>
        )}
        {concurs.organizator && (
          <p className="text-muted-foreground mt-4 text-sm">
            Organizat de{' '}
            <span className="text-foreground font-medium">{concurs.organizator.nume}</span>
          </p>
        )}
      </div>
    </article>
  )
}
