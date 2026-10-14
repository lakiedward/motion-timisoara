import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

const HERO_BADGE = 'px-3 py-1 text-sm font-semibold md:text-base'

export function CourseHero({
  name,
  photoUrl,
  sport,
  levelLabel,
}: {
  name: string
  photoUrl: string | null
  sport: { code: string; name: string } | null | undefined
  levelLabel: string | null
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = !!photoUrl && !photoFailed

  const badges = (sport || levelLabel) && (
    <div className="flex flex-wrap items-center gap-2">
      {sport && <Badge className={HERO_BADGE}>{sport.name}</Badge>}
      {levelLabel && (
        <Badge variant="outline" className={`bg-card ${HERO_BADGE}`}>
          {levelLabel}
        </Badge>
      )}
    </div>
  )

  if (showPhoto) {
    return (
      <section
        data-section="course-hero"
        className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]"
      >
        <img
          src={photoUrl}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--overlay-scrim) 0%, transparent 72%)' }}
        />
        <Link
          to="/cursuri"
          className="absolute top-6 left-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          <ArrowLeft className="size-4" /> Înapoi la cursuri
        </Link>
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-6 pb-7">
            {badges}
            <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {name}
            </h1>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section data-section="course-hero" className="mx-auto max-w-6xl px-6 pt-8">
      <Link
        to="/cursuri"
        className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la cursuri
      </Link>
      <div className="mt-4">{badges}</div>
      <h1 className="font-display text-foreground mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
        {name}
      </h1>
      <SportIllustration
        code={sport?.code}
        name={sport?.name}
        className="mt-6 h-44 rounded-xl border md:h-56"
      />
    </section>
  )
}
