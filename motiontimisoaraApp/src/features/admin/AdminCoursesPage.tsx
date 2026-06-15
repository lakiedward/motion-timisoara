import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getAllCourses, setCourseActiveAdmin } from '@/api/admin'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminCoursesPage() {
  const qc = useQueryClient()
  const { data: courses = [], isLoading } = useQuery({ queryKey: ['admin-courses'], queryFn: getAllCourses })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCourseActiveAdmin(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-courses'] }),
    onError: () => toast.error('Nu am putut actualiza cursul.'),
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Cursuri</h1>
      {isLoading ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-3xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Curs</th>
                <th className="px-4 py-3 font-semibold">Sport</th>
                <th className="px-4 py-3 font-semibold">Antrenor</th>
                <th className="px-4 py-3 font-semibold">Preț</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="text-muted-foreground px-4 py-3">{c.sport?.name ?? '—'}</td>
                  <td className="text-muted-foreground px-4 py-3">{c.coach?.name ?? '—'}</td>
                  <td className="px-4 py-3">{formatRon(c.price)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.active ? 'success' : 'outline'}>{c.active ? 'Activ' : 'Inactiv'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: c.id, active: !c.active })}>
                      {c.active ? 'Dezactivează' : 'Activează'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
