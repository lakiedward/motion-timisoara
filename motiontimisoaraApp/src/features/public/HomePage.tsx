import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { ScrollReveal } from '@/components/ScrollReveal'
import { getCourses } from '@/api/public'
import { CourseCard } from './components/CourseCard'

const HERO_IMG = '/ui/20221013_183129.webp'
const CTA_IMG = '/ui/20210405_152345.webp'

const STATS = [
  { number: '11', label: 'Ani experiență' },
  { number: '200+', label: 'Copii antrenați' },
  { number: '8', label: 'Antrenori' },
  { number: '5', label: 'Sporturi' },
]

const VALUE_PROPS = [
  { title: 'Antrenori verificați', text: 'Cluburi și antrenori de încredere, cu profiluri publice și evaluări.' },
  { title: 'Multi-sport', text: 'Înot, ciclism, alergare și mai mult — totul într-un singur loc.' },
  { title: 'Plăți simple', text: 'Înscrieri și plăți online sau cash, cu istoric clar pentru părinți.' },
  { title: 'Mereu informat', text: 'Calendar, prezență și anunțuri în timp real de la antrenori.' },
]

const TESTIMONIALS = [
  { quote: 'Copilul meu abia așteaptă fiecare antrenament. Antrenorii sunt extraordinari!', name: 'Andreea M.', role: 'Părinte' },
  { quote: 'În doar un an a învățat să înoate corect și a câștigat încredere în el.', name: 'Cristian D.', role: 'Părinte' },
]

export default function HomePage() {
  const { data: courses = [] } = useQuery({ queryKey: ['courses', 'all'], queryFn: () => getCourses() })
  const topCourses = courses.slice(0, 3)

  return (
    <>
      {/* HERO — photo with a diagonal brand-gradient wedge carrying the headline */}
      <section className="relative overflow-hidden">
        <div className="relative flex min-h-[82vh] items-center">
          <img
            src={HERO_IMG}
            alt=""
            className="absolute inset-0 size-full object-cover"
            fetchPriority="high"
          />
          <div
            className="absolute inset-y-0 left-0 w-[88%] sm:w-[72%] md:w-[58%]"
            style={{
              background: 'var(--gradient-primary)',
              clipPath: 'polygon(0 0, 100% 0, 76% 100%, 0 100%)',
            }}
          />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
            <div className="max-w-md md:max-w-xl">
              <span className="eyebrow mb-4">Triatlon pentru copii · Timișoara</span>
              <h1 className="font-display text-5xl leading-[1.02] font-extrabold text-white sm:text-6xl md:text-7xl lg:text-8xl">
                Creștem <span className="italic">campionii</span> de mâine
              </h1>
              <p className="mt-5 max-w-sm text-lg text-white/85 md:text-xl">
                Antrenamente de triatlon distractive și profesioniste pentru copii — înot, ciclism
                și alergare, alături de antrenori dedicați.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/signup" className="btn-cta bg-white font-bold text-primary hover:scale-105">
                  Înscrie-te <ArrowRight className="size-5" />
                </Link>
                <Link
                  to="/cursuri"
                  className="btn-cta border-2 border-white/70 text-white transition-colors hover:border-white hover:bg-white/10"
                >
                  Vezi programele
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats ticker */}
        <div className="bg-foreground">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-10 gap-y-3 px-6 py-5">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-4">
                {i > 0 && <span className="hidden h-8 w-px bg-white/20 sm:block" aria-hidden="true" />}
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold text-white md:text-3xl">
                    {s.number}
                  </span>
                  <span className="text-xs tracking-wide text-white/60 uppercase md:text-sm">
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE PROPS — editorial numbered list instead of icon cards */}
      <section className="bg-secondary/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 max-w-2xl">
            <span className="eyebrow mb-3">De ce Motion Timișoara</span>
            <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
              Nu suntem doar un club de sport.
            </h2>
          </div>
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {VALUE_PROPS.map((vp, i) => (
              <ScrollReveal key={vp.title} delay={i * 80}>
                <div className="border-border flex gap-5 border-t pt-6">
                  <span className="font-display text-primary/25 text-4xl leading-none font-extrabold md:text-5xl">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{vp.title}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm">{vp.text}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAMS (real data) — diagonal brand band behind the course cards */}
      {topCourses.length > 0 && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-foreground" />
          <div
            className="absolute inset-0"
            style={{
              background: 'var(--gradient-primary)',
              clipPath: 'polygon(0 10%, 100% 0%, 100% 100%, 0 90%)',
            }}
          />
          <div className="relative mx-auto max-w-7xl px-6 py-24">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="eyebrow mb-2">Programe</span>
                <h2 className="font-display text-3xl font-extrabold text-white md:text-5xl">
                  Programe populare
                </h2>
              </div>
              <Link
                to="/cursuri"
                className="hidden items-center gap-1 font-semibold text-white transition-colors hover:text-white/80 sm:inline-flex"
              >
                Toate cursurile <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-7 md:grid-cols-3">
              {topCourses.map((c, i) => (
                <ScrollReveal key={c.id} delay={i * 80}>
                  <CourseCard course={c} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS — one oversized editorial quote + one supporting quote */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <ScrollReveal>
          <figure className="relative">
            <span
              className="font-display text-primary/10 pointer-events-none absolute -top-16 -left-2 text-[10rem] leading-none select-none md:-left-8 md:text-[16rem]"
              aria-hidden="true"
            >
              “
            </span>
            <blockquote className="font-display relative text-2xl leading-snug font-bold text-foreground md:text-4xl">
              {TESTIMONIALS[0].quote}
            </blockquote>
            <figcaption className="relative mt-6 flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
                {TESTIMONIALS[0].name.charAt(0)}
              </span>
              <div>
                <div className="font-bold text-foreground">{TESTIMONIALS[0].name}</div>
                <div className="text-muted-foreground text-sm">{TESTIMONIALS[0].role}</div>
              </div>
            </figcaption>
          </figure>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <figure className="border-highlight mt-14 max-w-lg border-l-4 pl-6 md:ml-24">
            <blockquote className="text-muted-foreground text-lg leading-relaxed italic">
              {TESTIMONIALS[1].quote}
            </blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-foreground">
              {TESTIMONIALS[1].name}{' '}
              <span className="text-muted-foreground font-normal">· {TESTIMONIALS[1].role}</span>
            </figcaption>
          </figure>
        </ScrollReveal>
      </section>

      {/* FINAL CTA — gradient over a real training photo */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[2rem] px-8 py-20 text-center md:py-28">
          <img
            src={CTA_IMG}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(120deg, rgba(37,99,235,0.94) 0%, rgba(14,165,233,0.88) 100%)',
            }}
          />
          <div className="relative z-10">
            <h2 className="font-display text-3xl font-extrabold text-white md:text-5xl">
              Începe călătoria
            </h2>
            <p className="mx-auto mt-3 max-w-md text-lg text-white/90">
              Creează un cont gratuit și înscrie-ți copilul la primul curs astăzi.
            </p>
            <Link
              to="/signup"
              className="btn-cta text-primary mt-8 bg-white font-bold hover:scale-105"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
