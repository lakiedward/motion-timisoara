import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyCourses, setCourseActive } from '@/api/coach'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function CoachCoursesPage() {
  const qc = useQueryClient()
  const { data: courses = [], isLoading } = useQuery({ queryKey: ['my-courses'], queryFn: getMyCourses })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCourseActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-courses'] }),
    onError: () => toast.error('Nu am putut actualiza cursul.'),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cursurile mele</h1>
        <Button asChild>
          <Link to="/coach/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : courses.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.sport && <Badge>{c.sport.name}</Badge>}
                    <Badge variant={c.active ? 'success' : 'outline'}>
                      {c.active ? 'Activ' : 'Inactiv'}
                    </Badge>
                  </div>
                </div>
                <span className="font-display font-bold">{formatRon(c.price)}</span>
              </div>
              <div className="text-muted-foreground mt-2 text-sm">
                {c.location?.name ?? '—'}
                {c.age_from != null && ` · ${c.age_from}–${c.age_to} ani`}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/coach/courses/${c.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                >
                  {c.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun curs încă.{' '}
          <Link to="/coach/courses/new" className="text-primary font-semibold">
            Creează primul curs
          </Link>
        </div>
      )}
    </div>
  )
}
