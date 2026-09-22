import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getConcursPublic } from '@/api/competitions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function CompetitionDetailsPage() {
  const { slug = '' } = useParams()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['concurs-public', slug],
    queryFn: () => getConcursPublic(slug),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca concursul.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Concursul nu a fost găsit.</p>
        <Link
          to="/concursuri"
          className="text-primary mt-4 inline-flex h-11 items-center font-semibold"
        >
          ← Înapoi la concursuri
        </Link>
      </div>
    )
  }

  return (
    <div>
      {data.heroUrl ? (
        <div className="relative h-64 w-full overflow-hidden md:h-96">
          <img src={data.heroUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      ) : (
        <div className="from-primary/20 to-background h-32 w-full bg-gradient-to-b md:h-44" />
      )}

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/concursuri"
          className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi la concursuri
        </Link>
        <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold md:text-4xl">
          {data.title}
        </h1>
        {data.organizator && (
          <p className="text-muted-foreground mt-4 text-sm">
            Organizat de{' '}
            <Link
              to={data.organizator.link}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {data.organizator.nume}
            </Link>
          </p>
        )}
        <p className="text-muted-foreground mt-6 leading-relaxed whitespace-pre-wrap">
          {data.description}
        </p>
      </div>
    </div>
  )
}
