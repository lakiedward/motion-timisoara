import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, GraduationCap, Users } from 'lucide-react'

import { getAdminStats } from '@/api/admin'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats })

  const stats = [
    { label: 'Utilizatori', value: data?.users, icon: Users, to: '/admin/users' },
    { label: 'Antrenori', value: data?.coaches, icon: GraduationCap, to: '/admin/users' },
    { label: 'Cluburi', value: data?.clubs, icon: Building2, to: '/admin/clubs' },
    { label: 'Cursuri', value: data?.courses, icon: GraduationCap, to: '/admin/courses' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Administrare</h1>
        <p className="text-muted-foreground mt-1">Privire de ansamblu asupra platformei.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="bg-card shadow-card hover:shadow-card-hover rounded-3xl p-6 transition-all hover:-translate-y-1"
          >
            <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
              <s.icon className="size-5" />
            </span>
            <div className="font-display mt-4 text-3xl font-extrabold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : s.value}
            </div>
            <div className="text-muted-foreground text-sm">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
