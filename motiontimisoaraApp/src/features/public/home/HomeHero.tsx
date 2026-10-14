import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { getCoaches, publicUrl, type CoachListItem } from '@/api/public'
import { getHomeStats, type HomeStats } from '@/api/home'
import { Skeleton } from '@/components/ui/skeleton'
import { plural } from '@/lib/plural'

const HERO_IMG = '/ui/20221013_183129.webp'
const STRIP_SIZE = 5

const STAT_LABELS: { key: keyof HomeStats; singular: string; plural: string }[] = [
  { key: 'clubs', singular: 'Club', plural: 'Cluburi' },
  { key: 'coaches', singular: 'Antrenor', plural: 'Antrenori' },
  { key: 'sports', singular: 'Sport', plural: 'Sporturi' },
  { key: 'courses', singular: 'Curs activ', plural: 'Cursuri active' },
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('ro'))
    .join('')
}

function coachPhoto(coach: CoachListItem): string | null {
  return publicUrl('coach-photos', coach.photo_storage_path) ?? coach.profile?.avatar_url ?? coach.avatar_url ?? null
}

function CoachStrip() {
  const { data: coaches } = useQuery({ queryKey: ['coaches'], queryFn: getCoaches })
  if (!coaches?.length) return null
  const shown = [...coaches].sort((a, b) => Number(!!coachPhoto(b)) - Number(!!coachPhoto(a))).slice(0, STRIP_SIZE)
  return (
    <Link
      to="/antrenori"
      data-home-coaches
      className="group mt-8 inline-flex min-h-touch-target items-center gap-3 rounded-full"
    >
      <span className="flex -space-x-2" aria-hidden="true">
        {shown.map((coach) => {
          const name = coach.profile?.name ?? 'Antrenor'
          const photo = coachPhoto(coach)
          return (
            <span
              key={coach.id}
              className="bg-accent text-accent-foreground ring-background grid size-10 place-items-center overflow-hidden rounded-full text-xs font-bold ring-2"
            >
              {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
            </span>
          )
        })}
      </span>
      <span className="text-foreground text-sm font-semibold whitespace-nowrap group-hover:text-primary">
        {plural(coaches.length, 'antrenor', 'antrenori')}
        <span className="hidden sm:inline"> te așteaptă</span>
        <ArrowRight aria-hidden="true" className="ml-1 inline size-4" />
      </span>
    </Link>
  )
}

function StatsRow() {
  const { data, isPending, isError } = useQuery({ queryKey: ['home', 'stats'], queryFn: getHomeStats })
  if (isError) return null
  const items = isPending ? STAT_LABELS : STAT_LABELS.filter(({ key }) => data[key] > 0)
  if (!items.length) return null
  return (
    <dl
      aria-busy={isPending}
      className="border-border mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-6 border-t px-6 py-8 sm:grid-cols-4"
    >
      {items.map(({ key, singular, plural: pluralLabel }) => (
        <div key={key} className="flex flex-col-reverse gap-1">
          <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {isPending ? pluralLabel : data[key] === 1 ? singular : pluralLabel}
          </dt>
          <dd className="font-display text-foreground text-3xl font-extrabold md:text-4xl">
            {isPending ? <Skeleton className="h-9 w-14" /> : data[key]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function HomeHero() {
  return (
    <section aria-labelledby="home-hero-title">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-10 pb-12 md:grid-cols-2 md:pt-20 md:pb-20">
        <div>
          <span className="eyebrow mb-4">Sport pentru copii · Timișoara</span>
          <h1
            id="home-hero-title"
            className="font-display text-foreground text-5xl leading-[1.05] font-extrabold md:text-6xl lg:text-7xl"
          >
            Găsește-i copilului <span className="text-primary italic">sportul</span> potrivit
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-lg md:text-xl">
            Cursuri, tabere și activități de la cluburi și antrenori din Timișoara. Compari
            programele și îl înscrii online.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/cursuri" className="btn-cta btn-cta--primary">
              Înscrie-te <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
            <Link to="/cluburi" className="btn-cta btn-cta--outline">
              Vezi cluburile
            </Link>
          </div>
          <CoachStrip />
        </div>
        <div className="relative hidden md:block">
          <div
            className="absolute -inset-3 rounded-3xl opacity-90"
            style={{ background: 'var(--gradient-primary)', clipPath: 'polygon(24% 0, 100% 0, 100% 100%, 0 100%)' }}
            aria-hidden="true"
          />
          <img
            src={HERO_IMG}
            alt="Copii la antrenament de înot"
            fetchPriority="high"
            className="relative aspect-[4/5] w-full rounded-3xl object-cover lg:aspect-[5/6]"
          />
        </div>
      </div>
      <StatsRow />
    </section>
  )
}
