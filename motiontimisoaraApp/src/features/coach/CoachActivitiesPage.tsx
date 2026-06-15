import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyActivities, setActivityActive } from '@/api/coach'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function CoachActivitiesPage() {
  const qc = useQueryClient()
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['my-activities'],
    queryFn: getMyActivities,
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setActivityActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-activities'] }),
    onError: () => toast.error('Nu am putut actualiza activitatea.'),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Activitățile mele</h1>
        <Button asChild>
          <Link to="/coach/activities/new">
            <Plus /> Activitate nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : activities.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {activities.map((a) => (
            <div key={a.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{a.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.sport && <Badge>{a.sport.name}</Badge>}
                    <Badge variant={a.active ? 'success' : 'outline'}>{a.active ? 'Activ' : 'Inactiv'}</Badge>
                  </div>
                </div>
                <span className="font-display font-bold">{formatRon(a.price)}</span>
              </div>
              <div className="text-muted-foreground mt-2 text-sm">
                {new Date(a.activity_date).toLocaleDateString('ro-RO')} · {a.start_time?.slice(0, 5)}–
                {a.end_time?.slice(0, 5)}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/coach/activities/${a.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: a.id, active: !a.active })}>
                  {a.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio activitate încă.{' '}
          <Link to="/coach/activities/new" className="text-primary font-semibold">
            Creează prima activitate
          </Link>
        </div>
      )}
    </div>
  )
}
