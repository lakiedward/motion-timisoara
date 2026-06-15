import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock, MapPin } from 'lucide-react'
import { toast } from 'sonner'

import { getActivity } from '@/api/public'
import { formatRon } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function ActivityDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: a, isLoading } = useQuery({ queryKey: ['activity', id], queryFn: () => getActivity(id) })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }
  if (!a) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Activitatea nu a fost găsită.</p>
        <Link to="/activitati" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la activități
        </Link>
      </div>
    )
  }

  const date = new Date(a.activity_date)
  const onEnroll = () => {
    if (!user) navigate(`/login?returnUrl=${encodeURIComponent(`/activitati/${a.id}`)}`)
    else toast.info('Înscrierea va fi disponibilă în curând (checkout — Faza 5).')
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/activitati" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Înapoi la activități
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {a.sport && <Badge>{a.sport.name}</Badge>}
      </div>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-foreground md:text-4xl">{a.name}</h1>

      <div className="text-muted-foreground mt-5 flex flex-wrap gap-5 text-sm">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4" /> {date.toLocaleDateString('ro-RO')}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-4" /> {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
        </span>
        {a.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" /> {a.location.name}
          </span>
        )}
      </div>

      {a.description && <p className="text-muted-foreground mt-6 leading-relaxed">{a.description}</p>}

      <div className="bg-card shadow-card mt-8 flex items-center justify-between rounded-3xl border p-6">
        <div className="font-display text-2xl font-extrabold">{formatRon(a.price)}</div>
        <button onClick={onEnroll} className="btn-cta btn-cta--primary">
          Înscrie-te
        </button>
      </div>
    </div>
  )
}
