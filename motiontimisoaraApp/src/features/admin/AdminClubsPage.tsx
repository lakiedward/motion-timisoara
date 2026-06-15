import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'

import { getAllClubs } from '@/api/admin'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminClubsPage() {
  const { data: clubs = [], isLoading } = useQuery({ queryKey: ['admin-clubs'], queryFn: getAllClubs })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Cluburi</h1>
      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : clubs.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((c) => (
            <div key={c.id} className="bg-card shadow-card flex items-center gap-3 rounded-3xl p-5">
              <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-muted-foreground truncate text-sm">{c.city ?? c.email ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun club înregistrat.
        </div>
      )}
    </div>
  )
}
