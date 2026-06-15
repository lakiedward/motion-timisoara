import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { toast } from 'sonner'

import { getCampBySlug } from '@/api/public'
import { formatRon } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { Skeleton } from '@/components/ui/skeleton'

export default function CampDetailsPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: camp, isLoading } = useQuery({
    queryKey: ['camp', slug],
    queryFn: () => getCampBySlug(slug),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }
  if (!camp) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Tabăra nu a fost găsită.</p>
        <Link to="/tabere" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la tabere
        </Link>
      </div>
    )
  }

  const onEnroll = () => {
    if (!user) navigate(`/login?returnUrl=${encodeURIComponent(`/tabere/${camp.slug}`)}`)
    else toast.info('Înscrierea va fi disponibilă în curând (checkout — Faza 5).')
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/tabere" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi la tabere
      </Link>
      <h1 className="font-display mt-6 text-3xl font-extrabold text-foreground md:text-4xl">{camp.title}</h1>
      <div className="text-muted-foreground mt-4 flex flex-wrap gap-5 text-sm">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4" />
          {new Date(camp.period_start).toLocaleDateString('ro-RO')} –{' '}
          {new Date(camp.period_end).toLocaleDateString('ro-RO')}
        </span>
        {camp.location_text && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" /> {camp.location_text}
          </span>
        )}
      </div>
      {camp.description && (
        <p className="text-muted-foreground mt-6 leading-relaxed">{camp.description}</p>
      )}
      <div className="bg-card shadow-card mt-8 flex items-center justify-between rounded-3xl border p-6">
        <div className="font-display text-2xl font-extrabold">{formatRon(camp.price)}</div>
        <button onClick={onEnroll} className="btn-cta btn-cta--primary">
          Înscrie-te
        </button>
      </div>
    </div>
  )
}
