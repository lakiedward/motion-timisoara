import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Plus } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { getMyCourses } from '@/api/coach'
import { Button } from '@/components/ui/button'

export default function CoachDashboard() {
  const { user } = useAuth()
  const { data: courses = [] } = useQuery({ queryKey: ['my-courses'], queryFn: getMyCourses })
  const active = courses.filter((c) => c.active).length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Salut, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">Panoul tău de antrenor.</p>
        </div>
        <Button asChild>
          <Link to="/coach/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat value={courses.length} label="Cursuri" />
        <Stat value={active} label="Cursuri active" />
        <Link
          to="/coach/courses"
          className="bg-primary text-primary-foreground flex items-center justify-between rounded-3xl p-6 transition-transform hover:-translate-y-1"
        >
          <span className="font-display font-bold">Gestionează cursuri</span>
          <GraduationCap className="size-5" />
        </Link>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card shadow-card rounded-3xl p-6">
      <div className="font-display text-3xl font-extrabold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  )
}
