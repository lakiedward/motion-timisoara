import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getCourses } from '@/api/public'
import { fetchSports } from '@/api/sports'
import { CourseCard } from './components/CourseCard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

export default function ProgramPage() {
  const [sport, setSport] = useState<string | undefined>(undefined)
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', sport ?? 'all'],
    queryFn: () => getCourses({ sportCode: sport }),
  })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Programe</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Cursuri</h1>
          <p className="text-muted-foreground mt-2">Găsește cursul potrivit pentru copilul tău.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip active={!sport} onClick={() => setSport(undefined)}>
            Toate
          </Chip>
          {sports.map((s) => (
            <Chip key={s.id} active={sport === s.code} onClick={() => setSport(s.code)}>
              {s.name}
            </Chip>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-7 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-3xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : courses.length ? (
          <div className="grid gap-7 md:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Nu am găsit cursuri pentru filtrul selectat.
          </div>
        )}
      </div>
    </div>
  )
}
