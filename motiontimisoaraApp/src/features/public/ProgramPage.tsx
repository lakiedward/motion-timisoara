import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchX } from 'lucide-react'

import { getCourses } from '@/api/public'
import { fetchSports } from '@/api/sports'
import { CourseCard } from './components/CourseCard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK, SPORT_ICON } from './sport-icons'

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  color?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? { backgroundColor: color ?? 'var(--primary)' } : undefined}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-bold transition-all',
        active
          ? 'text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)]'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground border'
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
      {/* HEADER — same diagonal brand band as the homepage "Programe populare" section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-foreground" />
        <div
          className="absolute inset-0"
          style={{
            background: 'var(--gradient-primary)',
            clipPath: 'polygon(0 0, 100% 0, 100% 82%, 0 100%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-20">
          <span className="eyebrow mb-3">Programe</span>
          <h1 className="font-display text-5xl font-extrabold text-white md:text-6xl">Cursuri</h1>
          <p className="mt-3 max-w-md text-lg text-white/85">
            Găsește cursul potrivit pentru copilul tău.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex flex-wrap gap-2.5">
          <Chip active={!sport} onClick={() => setSport(undefined)}>
            Toate
          </Chip>
          {sports.map((s) => (
            <Chip
              key={s.id}
              active={sport === s.code}
              onClick={() => setSport(s.code)}
              color={SPORT_COLOR[s.code] ?? SPORT_COLOR_FALLBACK}
            >
              {SPORT_ICON[s.code] ? `${SPORT_ICON[s.code]} ` : ''}
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
          <div className="border-border flex flex-col items-center gap-3 rounded-3xl border border-dashed py-24 text-center">
            <SearchX className="text-muted-foreground/50 size-10" />
            <p className="text-muted-foreground text-lg font-medium">
              Nu am găsit cursuri pentru filtrul selectat.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
